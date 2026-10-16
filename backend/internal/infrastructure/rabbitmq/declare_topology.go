package rabbitmq

import (
	"errors"
	"log"

	amqp "github.com/rabbitmq/amqp091-go"
)

// DeclareTopology sets up complete application exchanges, dead-letter queues,
// notification queues, document rendering queues, and AI triage queues.
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
		"kos.dlx", // name
		"direct",  // type
		true,      // durable
		false,     // auto-deleted
		false,     // internal
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		return errors.New("declare kos.dlx: " + err.Error())
	}

	// 3. Declare Dead Letter Queue & Bind to DLX
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

	// Common queue arguments routing rejected/failed messages to DLX
	dlqArgs := amqp.Table{
		"x-dead-letter-exchange":    "kos.dlx",
		"x-dead-letter-routing-key": "dead_letter",
	}

	// 4. Setup Application Work Queues with DLQ bindings
	queues := []struct {
		name        string
		routingKeys []string
	}{
		{
			name: "q.notification.whatsapp",
			routingKeys: []string{
				"event.notification.wa.*",
				"event.notification.whatsapp.#",
			},
		},
		{
			name: "q.notification.email",
			routingKeys: []string{
				"event.notification.email.*",
				"event.notification.email.#",
			},
		},
		{
			name: "q.document.contract_pdf",
			routingKeys: []string{
				"job.document.contract_pdf.#",
				"document.contract_pdf.#",
			},
		},
		{
			name: "q.document.report_csv",
			routingKeys: []string{
				"job.document.report_csv.#",
				"document.report_csv.#",
			},
		},
		{
			name: "q.ai.complaint_triage",
			routingKeys: []string{
				"job.ai.complaint_triage.#",
				"ai.complaint_triage.#",
			},
		},
	}

	for _, q := range queues {
		_, err = ch.QueueDeclare(
			q.name,
			true,  // durable
			false, // delete when unused
			false, // exclusive
			false, // no-wait
			dlqArgs,
		)
		if err != nil {
			return errors.New("declare " + q.name + ": " + err.Error())
		}

		for _, rk := range q.routingKeys {
			err = ch.QueueBind(
				q.name,
				rk,
				"kos.events.topic",
				false,
				nil,
			)
			if err != nil {
				return errors.New("bind " + q.name + " (" + rk + "): " + err.Error())
			}
		}
	}

	log.Printf("[RABBITMQ] Topology verified: 2 exchanges, 6 queues (DLQ-protected)")
	return nil
}
