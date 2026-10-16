package rabbitmq

import (
	"errors"
	"log"
)

// DeclareTopology sets up core application exchanges and dead-letter queues.
func (c *Connection) DeclareTopology() error {
	if c == nil || !c.enabled {
		return nil
	}

	ch, err := c.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	// 1. Declare Main Topic Exchange for Domain Events
	err = ch.ExchangeDeclare(
		"kos.events.topic", // name
		"topic",            // type
		true,               // durable
		false,              // auto-deleted
		false,              // internal
		false,              // no-wait
		nil,                // arguments
	)
	if err != nil {
		return errors.New("declare kos.events.topic: " + err.Error())
	}

	// 2. Declare Dead Letter Exchange (DLX)
	err = ch.ExchangeDeclare(
		"kos.dlx",  // name
		"direct",   // type
		true,       // durable
		false,      // auto-deleted
		false,      // internal
		false,      // no-wait
		nil,        // arguments
	)
	if err != nil {
		return errors.New("declare kos.dlx: " + err.Error())
	}

	// 3. Declare Dead Letter Queue
	_, err = ch.QueueDeclare(
		"q.dead_letter", // name
		true,            // durable
		false,           // delete when unused
		false,           // exclusive
		false,           // no-wait
		nil,             // arguments
	)
	if err != nil {
		return errors.New("declare q.dead_letter: " + err.Error())
	}

	// 4. Bind Dead Letter Queue to DLX
	err = ch.QueueBind(
		"q.dead_letter", // queue name
		"dead_letter",   // routing key
		"kos.dlx",       // exchange
		false,
		nil,
	)
	if err != nil {
		return errors.New("bind q.dead_letter to kos.dlx: " + err.Error())
	}

	log.Printf("[RABBITMQ] Core topology verified: kos.events.topic, kos.dlx, q.dead_letter")
	return nil
}
