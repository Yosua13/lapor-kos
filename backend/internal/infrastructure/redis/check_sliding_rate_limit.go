package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"
)

var slidingRateLimitScript = goredis.NewScript(`
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local member = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local current_count = redis.call('ZCARD', key)

if current_count < limit then
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, ttl)
    return 1
else
    return 0
end
`)

// CheckSlidingRateLimit evaluates a sliding window rate limit using Redis Sorted Sets (ZSET).
// key: unique identifier (e.g. client IP + route path)
// limit: maximum allowed requests in the sliding window
// window: duration of the window (e.g. 10s, 1m)
// Returns (allowed, error). If Redis is unavailable, returns (false, ErrRedisUnavailable).
func CheckSlidingRateLimit(ctx context.Context, client *Client, key string, limit int, window time.Duration) (bool, error) {
	if client == nil || client.Raw() == nil {
		return false, ErrRedisUnavailable
	}
	if limit <= 0 {
		limit = 10
	}
	if window <= 0 {
		window = time.Minute
	}

	now := time.Now()
	nowNano := now.UnixNano()
	windowStartNano := now.Add(-window).UnixNano()
	fullKey := fmt.Sprintf("ratelimit:%s", key)
	member := fmt.Sprintf("%d:%s", nowNano, uuid.NewString())
	ttlSeconds := int(window.Seconds()) + 1
	if ttlSeconds < 2 {
		ttlSeconds = 2
	}

	result, err := slidingRateLimitScript.Run(
		ctx,
		client.Raw(),
		[]string{fullKey},
		nowNano,
		windowStartNano,
		limit,
		ttlSeconds,
		member,
	).Int()

	if err != nil {
		// Fallback to pipeline execution if Lua eval fails in restricted environments
		pipe := client.Raw().TxPipeline()
		pipe.ZRemRangeByScore(ctx, fullKey, "-inf", fmt.Sprintf("%d", windowStartNano))
		cardCmd := pipe.ZCard(ctx, fullKey)
		if _, pipeErr := pipe.Exec(ctx); pipeErr != nil {
			return false, err
		}

		if cardCmd.Val() >= int64(limit) {
			return false, nil
		}

		addPipe := client.Raw().TxPipeline()
		addPipe.ZAdd(ctx, fullKey, goredis.Z{
			Score:  float64(nowNano),
			Member: member,
		})
		addPipe.Expire(ctx, fullKey, time.Duration(ttlSeconds)*time.Second)
		if _, addErr := addPipe.Exec(ctx); addErr != nil {
			return false, addErr
		}
		return true, nil
	}

	return result == 1, nil
}

// CheckSlidingRateLimit is a convenience method on *Client.
func (c *Client) CheckSlidingRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	return CheckSlidingRateLimit(ctx, c, key, limit, window)
}
