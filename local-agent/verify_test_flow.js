const supabaseUrl = 'https://faquqlnwniinqqfmonbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcXVxbG53bmlpbnFxZm1vbmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODM2MDEsImV4cCI6MjA5NzI1OTYwMX0.ybRf0Y0V4XoEryFRh1-zIWnn6d9IJEUNr86d5oCLOpk';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyFlow() {
  const email = `testuser_autom_${Date.now()}@escencial.com`;
  const password = 'Test123456Password!';
  const fullName = 'Test User Autom';
  const organizationId = '4e6c4345-3e12-4e03-8dba-1d3ba7234b96'; // Escencial org id

  try {
    console.log(`1. Creating test user: ${email}...`);
    const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          full_name: fullName,
          organization_id: organizationId
        }
      })
    });

    if (!signupRes.ok) {
      console.error("Signup failed:", await signupRes.text());
      return;
    }

    const signupData = await signupRes.json();
    const userId = signupData.id || signupData.user?.id;
    console.log(`Signup success! User ID: ${userId}`);

    // Wait 2 seconds for triggers to set up user profile
    await delay(2000);

    console.log(`2. Logging in as user: ${email}...`);
    const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!loginRes.ok) {
      console.error("Login failed:", await loginRes.text());
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.access_token;
    console.log("Logged in successfully. Obtained access token.");

    const userHeaders = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log("3. Starting KYC verification record...");
    // Check if verification row exists, if not insert it
    const verifCheckRes = await fetch(`${supabaseUrl}/rest/v1/identity_verifications?user_id=eq.${userId}&select=id,status`, {
      headers: userHeaders
    });
    let verifications = await verifCheckRes.json();
    let verification;

    if (verifications.length > 0) {
      verification = verifications[0];
      console.log(`Found existing verification: ID: ${verification.id}, Status: ${verification.status}`);
    } else {
      console.log("Inserting new identity verification row...");
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/identity_verifications`, {
        method: 'POST',
        headers: {
          ...userHeaders,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: userId,
          organization_id: organizationId,
          status: 'PENDING'
        })
      });
      if (!insertRes.ok) {
        console.error("Failed to insert verification:", await insertRes.text());
        return;
      }
      const inserted = await insertRes.json();
      verification = inserted[0];
      console.log(`Inserted verification: ID: ${verification.id}, Status: ${verification.status}`);
    }

    console.log("4. Updating personal data (Step 0 / Step 1 terms)...");
    const updatePersonalRes = await fetch(`${supabaseUrl}/rest/v1/identity_verifications?id=eq.${verification.id}`, {
      method: 'PATCH',
      headers: userHeaders,
      body: JSON.stringify({
        full_name: fullName,
        document_type: 'DNI',
        document_number: '99887766',
        cuil_cuit: '20-99887766-9',
        birth_date: '1995-01-01',
        phone: '+5491122334455',
        address: 'Calle Falsa 123',
        city: 'CABA',
        province: 'Buenos Aires',
        country: 'Argentina'
      })
    });
    if (!updatePersonalRes.ok) {
      console.error("Failed to update personal data:", await updatePersonalRes.text());
      return;
    }
    console.log("Personal data updated successfully.");

    // Update terms acceptance on user metadata or profile
    const updateTermsRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: userHeaders,
      body: JSON.stringify({
        terms_accepted_at: new Date().toISOString()
      })
    });
    if (!updateTermsRes.ok) {
      console.error("Failed to accept terms:", await updateTermsRes.text());
      return;
    }
    console.log("Terms accepted successfully.");

    console.log("5. Creating DIDIT session via kyc-create-session Edge Function...");
    const sessionRes = await fetch(`${supabaseUrl}/functions/v1/kyc-create-session`, {
      method: 'POST',
      headers: userHeaders
    });

    if (!sessionRes.ok) {
      console.error("Failed to create DIDIT session:", await sessionRes.text());
      return;
    }

    const sessionData = await sessionRes.json();
    console.log("DIDIT session created successfully:", sessionData);
    const sessionId = sessionData.sessionId;

    if (!sessionId) {
      console.error("No sessionId returned from edge function!");
      return;
    }

    console.log("6. Verifying database session state...");
    const dbCheckRes = await fetch(`${supabaseUrl}/rest/v1/identity_verifications?id=eq.${verification.id}&select=status,provider_session_id`, {
      headers: userHeaders
    });
    const dbVerifs = await dbCheckRes.json();
    console.log("Database status:", dbVerifs[0]?.status, "Session ID:", dbVerifs[0]?.provider_session_id);

    console.log("7. Simulating DIDIT webhook callback (GET request)...");
    const webhookUrl = `${supabaseUrl}/functions/v1/kyc-webhook?status=Approved&session_id=${sessionId}`;
    console.log(`Calling GET: ${webhookUrl}`);
    const webhookRes = await fetch(webhookUrl);
    
    if (!webhookRes.ok) {
      console.error("Webhook callback failed:", await webhookRes.text());
      return;
    }
    console.log("Webhook call response:", await webhookRes.text());

    console.log("8. Polling status to verify completion...");
    for (let i = 0; i < 5; i++) {
      await delay(1000);
      const pollRes = await fetch(`${supabaseUrl}/rest/v1/identity_verifications?id=eq.${verification.id}&select=status`, {
        headers: userHeaders
      });
      const data = await pollRes.json();
      console.log(`[Poll ${i + 1}] Verification status in database: ${data[0]?.status}`);
      if (data[0]?.status === 'VERIFIED') {
        console.log("SUCCESS: User status is now VERIFIED!");
        break;
      }
    }

    // Check user profile verification_status
    const userProfileRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=verification_status`, {
      headers: userHeaders
    });
    const profile = await userProfileRes.json();
    console.log("User profile verification_status:", profile[0]?.verification_status);

  } catch (err) {
    console.error("Exception in verification flow:", err);
  }
}

verifyFlow();
