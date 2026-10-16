package redis

// Close gracefully closes the Redis client connection pool.
func (c *Client) Close() error {
	if c == nil || !c.enabled || c.rawClient == nil {
		return nil
	}
	return c.rawClient.Close()
}
