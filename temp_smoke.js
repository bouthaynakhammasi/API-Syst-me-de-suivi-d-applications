const base = 'http://127.0.0.1:3000';
const headers = { 'Content-Type': 'application/json' };
async function req(path, opts = {}) {
  const res = await fetch(base + path, { headers, ...opts });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}
(async () => {
  try {
    const companyId = 'fc3822fe-6e30-4526-b100-ea8e60dfd418';
    const candidateEmail = `cand${Date.now()}@test.com`;
    const recruiterEmail = `recruit${Date.now()}@test.com`;
    console.log('candidateEmail', candidateEmail);
    console.log('recruiterEmail', recruiterEmail);
    let r = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: candidateEmail, password: 'Password1!', role: 'candidate' }),
    });
    console.log('register candidate', r);
    r = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: recruiterEmail, password: 'Password1!', role: 'recruiter', company_id: companyId }),
    });
    console.log('register recruiter', r);
    r = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: candidateEmail, password: 'Password1!' }),
    });
    console.log('login candidate', r);
    const ctoken = r.body?.token;
    r = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: recruiterEmail, password: 'Password1!' }),
    });
    console.log('login recruiter', r);
    const rtoken = r.body?.token;
    r = await req('/api/jobs', {
      method: 'POST',
      headers: { ...headers, Authorization: 'Bearer ' + rtoken },
      body: JSON.stringify({ title: 'Software Engineer', description: 'Build things' }),
    });
    console.log('create job', r);
    const jobId = r.body?.id;
    r = await req(`/api/jobs/${jobId}/applications`, {
      method: 'POST',
      headers: { ...headers, Authorization: 'Bearer ' + ctoken },
      body: JSON.stringify({ resume_url: 'http://example.com/resume.pdf' }),
    });
    console.log('apply job', r);
    const appId = r.body?.id;
    r = await req(`/api/applications/${appId}/stage`, {
      method: 'PUT',
      headers: { ...headers, Authorization: 'Bearer ' + rtoken },
      body: JSON.stringify({ stage: 'Screening' }),
    });
    console.log('update stage', r);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
