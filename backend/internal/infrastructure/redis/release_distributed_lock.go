package redis

import (
	"context"
	"strings"

	goredis "github.com/redis/go-redis/v9"
)

var releaseLockScript = goredis.NewScript(`
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`)

// ReleaseDistributedLock atomically releases a distributed lock using a Lua script
// ensuring that a process only deletes the lock if its token matches the holder's token.
func ReleaseDistributedLock(ctx context.Context, client *Client, lockKey string, val string) error {
	if client == nil || !client.IsEnabled() || client.Raw() == nil {
		return nil
	}

	key := lockKey
	if !strings.HasPrefix(key, "lock:") {
		key = "lock:" + key
	}

	return releaseLockScript.Run(ctx, client.Raw(), []string{key}, val).Err()
}

// ReleaseDistributedLock is a convenience method on *Client.
func (c *Client) ReleaseDistributedLock(ctx context.Context, lockKey string, val string) error {
	return ReleaseDistributedLock(ctx, c, lockKey, val)
}
