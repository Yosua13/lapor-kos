package service

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"strconv"

	"gopkg.in/gomail.v2"
)

type EmailServiceInterface interface {
	SendVerificationEmail(email string, token string) error
	SendOTPEmail(email string, otp string) error
}

type EmailService struct {
	host        string
	port        int
	user        string
	pass        string
	sender      string
	frontendURL string
}

func NewEmailService() *EmailService {
	port, _ := strconv.Atoi(os.Getenv("SMTP_PORT"))
	if port == 0 {
		port = 587
	}

	return &EmailService{
		host:        os.Getenv("SMTP_HOST"),
		port:        port,
		user:        os.Getenv("SMTP_USER"),
		pass:        os.Getenv("SMTP_PASS"),
		sender:      os.Getenv("SMTP_SENDER"),
		frontendURL: os.Getenv("FRONTEND_URL"),
	}
}

func (s *EmailService) sendEmail(to string, subject string, body string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.sender)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", body)

	d := gomail.NewDialer(s.host, s.port, s.user, s.pass)

	return d.DialAndSend(m)
}

func (s *EmailService) SendVerificationEmail(email string, token string) error {
	verificationURL := fmt.Sprintf("%s/verify-email?token=%s", s.frontendURL, token)

	data := struct {
		URL string
	}{
		URL: verificationURL,
	}

	tmpl, err := template.New("verification").Parse(verificationTemplate)
	if err != nil {
		return err
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return err
	}

	return s.sendEmail(email, "Verifikasi Email - Lapor Kos", body.String())
}

func (s *EmailService) SendOTPEmail(email string, otp string) error {
	data := struct {
		OTP string
	}{
		OTP: otp,
	}

	tmpl, err := template.New("otp").Parse(otpTemplate)
	if err != nil {
		return err
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return err
	}

	return s.sendEmail(email, "Kode OTP Reset Password - Lapor Kos", body.String())
}

const verificationTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #0D9488; padding: 40px 20px; text-align: center; color: white; }
        .content { padding: 40px; text-align: center; }
        .button { display: inline-block; padding: 14px 32px; background-color: #0D9488; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: 600; margin-top: 24px; transition: background 0.3s; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f4f4f4; }
        h1 { margin: 0; font-size: 24px; font-weight: 700; }
        p { margin: 16px 0; color: #4B5563; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Selamat Datang di Lapor Kos!</h1>
        </div>
        <div class="content">
            <p>Halo,</p>
            <p>Terima kasih telah mendaftar di Lapor Kos. Selangkah lagi untuk memulai mengelola kos Anda dengan lebih mudah.</p>
            <p>Silakan klik tombol di bawah ini untuk memverifikasi alamat email Anda:</p>
            <a href="{{.URL}}" class="button">Verifikasi Email Sekarang</a>
            <p style="font-size: 14px; color: #9CA3AF; margin-top: 32px;">
                Jika tombol di atas tidak berfungsi, Anda dapat menyalin dan menempelkan tautan berikut ke browser Anda: <br>
                <a href="{{.URL}}" style="color: #0D9488; word-break: break-all;">{{.URL}}</a>
            </p>
        </div>
        <div class="footer">
            &copy; 2024 Lapor Kos. Semua hak dilindungi undang-undang.
        </div>
    </div>
</body>
</html>
`

const otpTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #0D9488; padding: 40px 20px; text-align: center; color: white; }
        .content { padding: 40px; text-align: center; }
        .otp-box { font-size: 36px; font-weight: 800; color: #0D9488; letter-spacing: 8px; margin: 30px 0; padding: 20px; background: #F0FDFA; border-radius: 12px; border: 2px dashed #99F6E4; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f4f4f4; }
        h1 { margin: 0; font-size: 24px; font-weight: 700; }
        p { margin: 16px 0; color: #4B5563; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Reset Password</h1>
        </div>
        <div class="content">
            <p>Halo,</p>
            <p>Kami menerima permintaan untuk mereset kata sandi akun Lapor Kos Anda. Gunakan kode OTP di bawah ini untuk melanjutkan:</p>
            <div class="otp-box">{{.OTP}}</div>
            <p>Kode ini berlaku selama 10 menit. Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.</p>
        </div>
        <div class="footer">
            &copy; 2024 Lapor Kos. Semua hak dilindungi undang-undang.
        </div>
    </div>
</body>
</html>
`
