package serverping

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"time"
)

type ServerStatus struct {
	Online  bool   `json:"online"`
	Host    string `json:"host"`
	Port    int    `json:"port"`
	Version string `json:"version"`
	MOTD    string `json:"motd"`
	Players struct {
		Online int `json:"online"`
		Max    int `json:"max"`
	} `json:"players"`
	PingMs int64 `json:"pingMs"`
}

func writeVarInt(buf *bytes.Buffer, value int) {
	for {
		if (value & ^0x7F) == 0 {
			buf.WriteByte(byte(value))
			return
		}
		buf.WriteByte(byte((value & 0x7F) | 0x80))
		value >>= 7
	}
}

func readVarInt(r io.Reader) (int, error) {
	var result int
	var numRead int
	b := make([]byte, 1)

	for {
		_, err := r.Read(b)
		if err != nil {
			return 0, err
		}
		val := b[0]
		result |= int(val&0x7F) << (7 * numRead)
		numRead++
		if numRead > 5 {
			return 0, errors.New("VarInt muito grande")
		}
		if (val & 0x80) == 0 {
			break
		}
	}
	return result, nil
}

func Ping(host string, port int, timeout time.Duration) *ServerStatus {
	result := &ServerStatus{
		Online: false,
		Host:   host,
		Port:   port,
		MOTD:   "Servidor Offline",
	}

	if timeout <= 0 {
		timeout = 3 * time.Second
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	start := time.Now()

	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return result
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(timeout))

	// Handshake Packet
	var handshakeBuf bytes.Buffer
	handshakeBuf.WriteByte(0x00) // Packet ID
	writeVarInt(&handshakeBuf, 47) // Protocol 47
	writeVarInt(&handshakeBuf, len(host))
	handshakeBuf.WriteString(host)
	binary.Write(&handshakeBuf, binary.BigEndian, uint16(port))
	writeVarInt(&handshakeBuf, 1) // Next state: 1 (status)

	var fullHandshake bytes.Buffer
	writeVarInt(&fullHandshake, handshakeBuf.Len())
	fullHandshake.Write(handshakeBuf.Bytes())

	if _, err := conn.Write(fullHandshake.Bytes()); err != nil {
		return result
	}

	// Status Request Packet (0x01, 0x00)
	if _, err := conn.Write([]byte{0x01, 0x00}); err != nil {
		return result
	}

	// Read response length
	_, err = readVarInt(conn)
	if err != nil {
		return result
	}

	// Read packet ID
	packetID, err := readVarInt(conn)
	if err != nil || packetID != 0x00 {
		return result
	}

	// Read string length
	strLen, err := readVarInt(conn)
	if err != nil || strLen <= 0 || strLen > 65536 {
		return result
	}

	jsonBytes := make([]byte, strLen)
	if _, err := io.ReadFull(conn, jsonBytes); err != nil {
		return result
	}

	latency := time.Since(start).Milliseconds()

	type rawSLP struct {
		Version struct {
			Name string `json:"name"`
		} `json:"version"`
		Players struct {
			Online int `json:"online"`
			Max    int `json:"max"`
		} `json:"players"`
		Description interface{} `json:"description"`
	}

	var parsed rawSLP
	if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
		return result
	}

	motd := "Forbidden Server"
	switch v := parsed.Description.(type) {
	case string:
		motd = v
	case map[string]interface{}:
		if t, ok := v["text"].(string); ok {
			motd = t
		}
	}

	// Clean Minecraft formatting codes
	cleanedMotd := cleanMinecraftColors(motd)

	result.Online = true
	result.Version = parsed.Version.Name
	result.MOTD = cleanedMotd
	result.Players.Online = parsed.Players.Online
	result.Players.Max = parsed.Players.Max
	result.PingMs = latency

	return result
}

func cleanMinecraftColors(s string) string {
	var sb strings.Builder
	runes := []rune(s)
	for i := 0; i < len(runes); i++ {
		if runes[i] == '§' && i+1 < len(runes) {
			i++ // Skip color code
			continue
		}
		sb.WriteRune(runes[i])
	}
	return strings.TrimSpace(sb.String())
}
