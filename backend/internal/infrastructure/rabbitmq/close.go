package rabbitmq

// Close gracefully stops the reconnect supervisor and closes the broker connection.
func (c *Connection) Close() error {
	if c == nil || !c.enabled {
		return nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closing {
		return nil
	}
	c.closing = true

	if c.closeChan != nil {
		close(c.closeChan)
	}

	if c.rawConn != nil && !c.rawConn.IsClosed() {
		return c.rawConn.Close()
	}
	return nil
}
