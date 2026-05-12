const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'OK' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
    };
  }

  const GMAIL_USER = process.env.GMAIL_USER || 'sim.agricultura.camaqua.rs@gmail.com';
  const GMAIL_PASS = process.env.GMAIL_PASS || 'zyctscuibqehkpgu';
  const FROM_NAME = process.env.GMAIL_FROM_NAME || 'SIM-CAMAQUA';

  if (!GMAIL_USER || !GMAIL_PASS) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Gmail configuration in environment variables.' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON body.' }),
    };
  }

  const { to, subject, html, plain_text, to_name, attachments } = payload || {};
  if (!to || !subject || !html) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required fields: to, subject, html.' }),
    };
  }

  let formattedAttachments = [];
  if (Array.isArray(attachments) && attachments.length > 0) {
    formattedAttachments = attachments.map(att => {
      if (att.encoding === 'base64') {
        return {
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType || 'application/pdf'
        };
      }
      return {
        filename: att.filename,
        content: Buffer.from(att.content),
        contentType: att.contentType || 'application/pdf'
      };
    });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"${FROM_NAME}" <${GMAIL_USER}>`,
    to,
    subject,
    text: plain_text || html.replace(/<[^>]*>?/gm, ''),
    html,
    attachments: attachments ? attachments.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content.data || att.content),
      contentType: att.contentType || 'application/pdf'
    })) : [],
  };

  try {
    await transporter.sendMail(mailOptions);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Email enviado com sucesso via Gmail.' }),
    };
  } catch (error) {
    console.error('send-email error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Erro ao enviar email via Gmail.' }),
    };
  }
};
