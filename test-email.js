const nodemailer = require('nodemailer');

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'info@voxi.kz',
      pass: 'glnu hrpj ybcv dtdq',
    },
  });

  try {
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: 'Voxi <info@voxi.kz>',
      to: 'batrbekk@gmail.com',
      subject: 'Test Email',
      html: '<h1>Test Email</h1><p>This is a test email from Voxi.</p>',
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('Error sending email:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
  }
}

testEmail();
