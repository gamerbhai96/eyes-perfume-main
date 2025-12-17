import Brevo from '@getbrevo/brevo';

// Initialize Brevo client with API key
const brevoClient = Brevo.ApiClient.instance;
const apiKey = brevoClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const brevo = new Brevo.TransactionalEmailsApi();

export async function sendOtpEmail(email, otp) {
  console.log('📧 Attempting to send OTP email to:', email);
  console.log('📧 Using Brevo API key:', apiKey.apiKey ? 'Key is set' : 'Key is NOT set');

  try {
    // IMPORTANT: The sender email must be verified in your Brevo account
    // Verified sender: EYES<kyleagent966@gmail.com>
    const senderEmail = process.env.EMAIL_FROM || 'kyleagent966@gmail.com';

    console.log('📧 Sender email:', senderEmail);

    const result = await brevo.sendTransacEmail({
      sender: {
        name: 'EYES Perfume',
        email: senderEmail,
      },
      to: [{ email }],
      subject: 'Your EYES Perfume OTP Code',
      htmlContent: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #d4af37; font-size: 32px; margin: 0;">✨ EYES</h1>
            <p style="color: #888; font-size: 14px;">Premium Fragrances</p>
          </div>
          <div style="background: linear-gradient(145deg, #1a1a1a, #2a2a2a); border-radius: 16px; padding: 40px; text-align: center;">
            <h2 style="color: #fff; margin: 0 0 20px;">Your Verification Code</h2>
            <div style="background: #d4af37; color: #000; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px; display: inline-block;">
              ${otp}
            </div>
            <p style="color: #888; margin-top: 24px; font-size: 14px;">
              This code expires in <strong>5 minutes</strong>
            </p>
          </div>
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log('✅ Brevo OTP email sent successfully to', email);
    console.log('📧 Brevo response:', JSON.stringify(result));
    return { success: true };
  } catch (err) {
    console.error('❌ Brevo email error:');
    console.error('   Status:', err?.response?.status);
    console.error('   Body:', JSON.stringify(err?.response?.body || err?.body));
    console.error('   Message:', err?.message);
    // Don't throw - allow login flow to continue even if email fails
    // but log the full error for debugging
    return { success: false, error: err?.message };
  }
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
