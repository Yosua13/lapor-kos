package config

// RedisConfig carries optional Redis connection settings.
//
// REDIS_URL (redis:// or rediss://) takes precedence. When it is empty,
// REDIS_ADDR plus REDIS_PASSWORD/REDIS_DB are used. Leaving both REDIS_URL and
// REDIS_ADDR empty disables Redis.
type RedisConfig struct {
	URL      string
	Addr     string
	Password string
	DB       int
}
