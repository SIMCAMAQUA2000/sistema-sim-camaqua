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
      body: JSON.stringify({ error: 'Invalid JSON body.' }),
    };
  }

  const { to, subject, html, plain_text, to_name, attachmentUrls } = payload;
  if (!to || !subject || !html) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: to, subject, html.' }),
    };
  }

  let attachments = [];
  if (Array.isArray(attachmentUrls) && attachmentUrls.length > 0) {
    for (const attachmentUrl of attachmentUrls) {
      try {
        const fileResponse = await fetch(attachmentUrl.url);
        if (fileResponse.ok) {
          const buffer = Buffer.from(await fileResponse.arrayBuffer());
          attachments.push({
            filename: attachmentUrl.filename,
            content: buffer,
            contentType: attachmentUrl.contentType || 'application/pdf'
          });
        }
      } catch (err) {
        console.warn('Não foi possível baixar anexo:', err);
      }
    }
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
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Erro ao enviar email via Gmail.' }),
    };
  }
};
