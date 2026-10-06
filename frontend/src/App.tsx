import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Provider } from './types';

const categories = ['PLUMBING', 'ELECTRICAL', 'BUILDING', 'CARPENTRY', 'PAINTING', 'HVAC', 'APPLIANCE', 'GENERAL'];

function Layout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('fixit_token');
  const user = JSON.parse(localStorage.getItem('fixit_user') || 'null');
  const navigate = useNavigate();
  const location = useLocation();
  const logout = () => { localStorage.removeItem('fixit_token'); localStorage.removeItem('fixit_user'); navigate('/'); };
  return <>
    <nav className="sticky-topbar border-bottom">
      <div className="container py-3 d-flex justify-content-between align-items-center gap-3">
        <Link to="/" className="brand-mark fs-3 text-dark">FIX <span className="text-success">it</span></Link>
        <div className="d-flex gap-2 align-items-center">
          <Link className="btn btn-sm btn-outline-dark" to="/request">Request a technician</Link>
          <Link className="btn btn-sm btn-outline-secondary" to="/track">Track</Link>
          {token ? <>
            <Link className="btn btn-sm btn-dark" to={user?.role === 'SUPER_ADMIN' ? '/admin' : '/provider'}>{user?.role === 'SUPER_ADMIN' ? 'Admin' : 'Dashboard'}</Link>
            <button className="btn btn-sm btn-light border" onClick={logout}>Sign out</button>
          </> : <Link className="btn btn-sm btn-dark" to="/provider/login">Provider login</Link>}
        </div>
      </div>
    </nav>
    <main className="container py-4">{children}</main>
    <footer className="container py-5 text-secondary small">FIX it MVP · Client privacy · Provider accountability · Auditable service delivery</footer>
  </>;
}

function Home() {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => { api.get('/public/providers').then(setProviders).catch(console.error); }, []);
  return <Layout>
    <section className="hero p-4 p-md-5 mb-5">
      <div className="row align-items-center g-4">
        <div className="col-lg-8">
          <div className="text-uppercase fw-semibold small opacity-75 mb-2">Trusted service marketplace</div>
          <h1 className="display-5 fw-bold">Find the right professional. Follow the work. Keep the record.</h1>
          <p className="lead opacity-75">FIX it connects clients with vetted technicians and tradespeople through a review-ranked job queue and a visible audit trail.</p>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link to="/request" className="btn btn-success btn-lg">Create a service request</Link>
            <Link to="/provider/register" className="btn btn-outline-light btn-lg">Join as a provider</Link>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="bg-white text-dark rounded-4 p-4">
            <div className="fw-bold mb-2">How assignment works</div>
            <div className="small text-secondary">Every request enters the open call pool. Verified providers are ranked by review performance and current availability. The highest-ranked eligible provider gets the first pull opportunity.</div>
          </div>
        </div>
      </div>
    </section>

    <div className="d-flex justify-content-between align-items-end mb-3">
      <div><div className="text-uppercase text-secondary small fw-bold">Public timeline</div><h2 className="section-title mb-0">Verified service providers</h2></div>
      <span className="small text-secondary">Reviews, qualifications and SOPs are public. Client contact information is not.</span>
    </div>
    <div className="row g-4">
      {providers.map(p => <ProviderCard key={p.id} provider={p} />)}
      {!providers.length && <div className="col-12"><div className="alert alert-light border">No verified providers yet. The super admin will publish providers after KYC approval.</div></div>}
    </div>
  </Layout>;
}

function ProviderCard({ provider }: { provider: Provider }) {
  const topReviews = (provider.reviews || []).slice(0, 2);
  return <div className="col-md-6 col-xl-4">
    <article className="card soft-card provider-card h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between gap-2">
          <div><h3 className="h5 fw-bold mb-1">{provider.firstName} {provider.lastName}</h3><div className="small text-secondary">{provider.categories.join(' · ')}</div></div>
          <div className="text-end"><div className="fw-bold">{provider.rating || 'New'} {provider.rating ? '★' : ''}</div><div className="small text-secondary">{provider.reviewCount} reviews</div></div>
        </div>
        {provider.bio && <p className="small mt-3 mb-2">{provider.bio}</p>}
        <div className="mb-2">{provider.qualifications.split(/\n|;/).slice(0, 4).map((q, i) => <span className="chip" key={i}>{q.trim()}</span>)}</div>
        <div className="small text-secondary mb-3">Areas: {provider.serviceAreas.join(', ')}</div>
        <div className="border-top pt-3">
          {topReviews.length ? topReviews.map(r => <div key={r.id} className="small mb-2">{r.emoji} <strong>{r.rating}/5</strong> — {r.comment}</div>) : <div className="small text-secondary">No public reviews yet.</div>}
        </div>
        <div className="d-flex gap-2 mt-3">
          <a className="btn btn-sm btn-outline-primary" href={`tel:${provider.phone}`}>Contact</a>
          <a className="btn btn-sm btn-outline-secondary" href={`mailto:${provider.email}`}>Email</a>
        </div>
      </div>
    </article>
  </div>;
}

function ProviderRegister() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(''); setMessage('');
    const data = new FormData(e.currentTarget);
    try { const result = await api.post('/auth/provider/register', data); setMessage(result.message); setTimeout(() => navigate('/provider/login'), 1200); }
    catch (err) { setError((err as Error).message); }
  };
  return <Layout><div className="row justify-content-center"><div className="col-lg-8"><div className="card soft-card"><div className="card-body p-4 p-md-5">
    <div className="text-uppercase text-secondary small fw-bold">Provider onboarding</div><h1 className="h2 fw-bold">Create your FIX it provider account</h1>
    <p className="text-secondary">KYC verification is mandatory before you can access client requests.</p>
    {message && <div className="alert alert-success">{message}</div>}{error && <div className="alert alert-danger">{error}</div>}
    <form onSubmit={submit} className="row g-3">
      <Field label="First name" name="firstName" required /><Field label="Last name" name="lastName" required /><Field label="Email" name="email" type="email" required /><Field label="Phone" name="phone" required /><Field label="Password" name="password" type="password" required />
      <TextArea label="Short bio" name="bio" />
      <TextArea label="Qualifications" name="qualifications" required help="List trade certifications, years of practice, licences, etc." />
      <TextArea label="Past references" name="references" help="Names/businesses and references you are allowed to publish." />
      <TextArea label="Public SOP" name="sop" required help="Explain your operating standard, client expectations and completion process." />
      <Field label="Service categories" name="categories" required help="Comma separated, e.g. PLUMBING,ELECTRICAL" />
      <Field label="Service areas" name="serviceAreas" required help="Comma separated, e.g. Wuse,Garki,Abuja" />
      <div className="col-12"><label className="form-label fw-semibold">KYC document</label><input className="form-control" type="file" name="kycDocument" accept=".pdf,.png,.jpg,.jpeg,.webp" /><div className="form-text">Accepted: PDF, PNG, JPG, WEBP — max 10 MB.</div></div>
      <div className="col-12"><button className="btn btn-dark btn-lg">Submit provider registration</button></div>
    </form>
  </div></div></div></div></Layout>;
}

function ProviderLogin() {
  const navigate = useNavigate(); const [error, setError] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setError(''); const fd = new FormData(e.currentTarget); try { const result = await api.post('/auth/login', Object.fromEntries(fd.entries())); localStorage.setItem('fixit_token', result.token); localStorage.setItem('fixit_user', JSON.stringify(result.user)); navigate(result.user.role === 'SUPER_ADMIN' ? '/admin' : '/provider'); } catch (err) { setError((err as Error).message); } };
  return <Layout><div className="row justify-content-center"><div className="col-md-6 col-lg-5"><div className="card soft-card"><div className="card-body p-4"><div className="text-uppercase text-secondary small fw-bold">Secure access</div><h1 className="h3 fw-bold">Provider / admin login</h1>{error && <div className="alert alert-danger">{error}</div>}<form onSubmit={submit} className="vstack gap-3"><Field label="Email" name="email" type="email" required /><Field label="Password" name="password" type="password" required /><button className="btn btn-dark btn-lg">Sign in</button></form><div className="small text-secondary mt-3">New provider? <Link to="/provider/register">Start onboarding</Link></div></div></div></div></div></Layout>;
}

function RequestPage() {
  const [result, setResult] = useState<any>(null); const [error, setError] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setError(''); setResult(null); const fd = new FormData(e.currentTarget); try { const data = await api.post('/public/requests', fd); localStorage.setItem(`fixit_client_token_${data.trackingCode}`, data.clientToken); setResult(data); } catch (err) { setError((err as Error).message); } };
  if (result) return <Layout><div className="row justify-content-center"><div className="col-lg-7"><div className="card soft-card"><div className="card-body p-4 p-md-5"><div className="text-success fw-bold">Request received</div><h1 className="h2 fw-bold">Your request is now in the open call pool.</h1><p>Keep these two values safe:</p><div className="bg-light rounded-4 p-3 mb-3"><div className="small text-secondary">Tracking code</div><div className="fs-4 fw-bold">{result.trackingCode}</div><div className="small text-secondary mt-2">Private client access key</div><div className="font-monospace small text-break">{result.clientToken}</div></div><Link className="btn btn-dark" to={`/track/${result.trackingCode}`}>Track this request</Link><p className="small text-secondary mt-3 mb-0">The public timeline never reveals your phone, email or address note.</p></div></div></div></div></Layout>;
  return <Layout><div className="row justify-content-center"><div className="col-lg-9"><div className="card soft-card"><div className="card-body p-4 p-md-5"><div className="text-uppercase text-secondary small fw-bold">Client request</div><h1 className="h2 fw-bold">Tell FIX it what needs to be fixed</h1><p className="text-secondary">No client account or card details are required. You receive a private access key after submission.</p>{error && <div className="alert alert-danger">{error}</div>}<form onSubmit={submit} className="row g-3">
    <Field label="Your name" name="clientName" required /><Field label="Email" name="clientEmail" type="email" required /><Field label="Phone" name="clientPhone" required /><Select label="Service category" name="category" options={categories} required /><Field label="Area / neighbourhood" name="area" required /><Field label="Preferred service date" name="preferredDate" type="datetime-local" /><TextArea label="What needs to be fixed?" name="description" required /><TextArea label="Address note" name="addressNote" help="Keep this brief; full private address details are not shown publicly." />
    <div className="col-12"><h2 className="h5 fw-bold">Payment receipt (optional at request time)</h2></div><Field label="Payment reference" name="paymentReference" /><Field label="Payment amount (NGN)" name="paymentAmount" type="number" /><TextArea label="Payment notes" name="paymentNotes" /><div className="col-12"><label className="form-label fw-semibold">Receipt upload</label><input className="form-control" type="file" name="receipt" accept=".pdf,.png,.jpg,.jpeg,.webp" /><div className="form-text">No card/bank details are entered into FIX it. Upload the receipt only.</div></div>
    <div className="col-12"><button className="btn btn-success btn-lg">Submit service request</button></div>
  </form></div></div></div></div></Layout>;
}

function TrackPage({ initialCode = '' }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode); const [accessKey, setAccessKey] = useState(() => initialCode ? localStorage.getItem(`fixit_client_token_${initialCode}`) || '' : ''); const [request, setRequest] = useState<any>(null); const [error, setError] = useState('');
  const load = async () => { setError(''); try { const data = await api.get(`/public/requests/${code.trim().toUpperCase()}`); setRequest(data); if (!accessKey) setAccessKey(localStorage.getItem(`fixit_client_token_${data.trackingCode}`) || ''); } catch (err) { setError((err as Error).message); } };
  return <Layout><div className="row g-4"><div className="col-lg-4"><div className="card soft-card"><div className="card-body p-4"><div className="text-uppercase text-secondary small fw-bold">Client tracking</div><h1 className="h4 fw-bold">Follow the job</h1><label className="form-label">Tracking code</label><input className="form-control mb-3" value={code} onChange={e => setCode(e.target.value)} placeholder="FIX-XXXXXXXX" /><label className="form-label">Private access key</label><textarea className="form-control mb-3" style={{minHeight: 90}} value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder="Required for comments, disputes and reviews" /><button className="btn btn-dark w-100" onClick={load}>Load request</button>{error && <div className="alert alert-danger mt-3">{error}</div>}</div></div></div><div className="col-lg-8">{request ? <ClientRequestView request={request} accessKey={accessKey} onReload={load} /> : <div className="card soft-card"><div className="card-body p-4 text-secondary">Enter your tracking code to see status and progress updates.</div></div>}</div></div></Layout>;
}

function ClientRequestView({ request, accessKey, onReload }: { request: any; accessKey: string; onReload: () => void }) {
  const [comment, setComment] = useState(''); const [complaint, setComplaint] = useState(false); const [review, setReview] = useState(''); const [rating, setRating] = useState('5'); const [dispute, setDispute] = useState(''); const [busy, setBusy] = useState('');
  const act = async (path: string, body: any) => { setBusy(path); try { await api.post(path, body, { 'x-client-token': accessKey }); setComment(''); setReview(''); setDispute(''); onReload(); } catch (err) { alert((err as Error).message); } finally { setBusy(''); } };
  return <>
    <div className="card soft-card mb-4"><div className="card-body p-4"><div className="d-flex justify-content-between align-items-start gap-3"><div><div className="text-uppercase text-secondary small fw-bold">{request.category}</div><h2 className="h4 fw-bold mb-1">{request.description}</h2><div className="small text-secondary">{request.area} · {request.trackingCode}</div></div><span className="status-pill bg-dark text-white">{request.status}</span></div>{request.provider && <div className="border rounded-4 p-3 mt-4"><div className="fw-bold">Assigned provider: {request.provider.name}</div><div className="small text-secondary">{request.provider.qualifications}</div><div className="d-flex gap-2 mt-2"><a href={`tel:${request.provider.phone}`} className="btn btn-sm btn-outline-primary">Call provider</a><a href={`mailto:${request.provider.email}`} className="btn btn-sm btn-outline-secondary">Email</a></div></div>}</div></div>
    <div className="card soft-card mb-4"><div className="card-body p-4"><h3 className="h5 fw-bold">Audit trail</h3>{request.audits.map((a: any) => <div className="timeline-item pb-4 mb-3" key={a.id}><div className="fw-semibold">{a.event.replaceAll('_',' ')}</div><div className="small text-secondary">{new Date(a.createdAt).toLocaleString()}</div><div className="mt-1">{a.note}</div></div>)}</div></div>
    <div className="card soft-card mb-4"><div className="card-body p-4"><h3 className="h5 fw-bold">Conversation & complaints</h3>{request.comments.map((c: any) => <div className="border rounded-3 p-2 mb-2 small" key={c.id}><strong>{c.authorType}</strong> {c.isComplaint ? '⚠️' : ''}: {c.text}<div className="text-secondary mt-1">{new Date(c.createdAt).toLocaleString()}</div></div>)}<textarea className="form-control mb-2" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Leave a comment or performance complaint" /><div className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={complaint} onChange={e=>setComplaint(e.target.checked)} id="complaint" /><label className="form-check-label" htmlFor="complaint">Mark as complaint for admin attention</label></div><button className="btn btn-outline-dark" disabled={!accessKey || !comment.trim() || !!busy} onClick={()=>act(`/public/requests/${request.trackingCode}/comments`, { text: comment, isComplaint: complaint })}>Post comment</button></div></div>
    <div className="row g-4"><div className="col-md-6"><div className="card soft-card h-100"><div className="card-body p-4"><h3 className="h5 fw-bold">Client review</h3>{request.review ? <div className="fs-5">{request.review.emoji} {request.review.rating}/5</div> : request.status === 'COMPLETED' || request.status === 'RESOLVED' ? <><select className="form-select mb-2" value={rating} onChange={e=>setRating(e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n}/5</option>)}</select><textarea className="form-control mb-2" value={review} onChange={e=>setReview(e.target.value)} placeholder="Tell future clients what happened" /><button className="btn btn-success" disabled={!review.trim() || !!busy} onClick={()=>act(`/public/requests/${request.trackingCode}/review`, { rating: Number(rating), comment: review })}>Publish review</button></> : <div className="text-secondary small">Review unlocks after the job is completed.</div>}</div></div></div><div className="col-md-6"><div className="card soft-card h-100"><div className="card-body p-4"><h3 className="h5 fw-bold">Raise a dispute</h3>{request.dispute ? <><div className="fw-bold">{request.dispute.status}</div><div className="small text-secondary mt-2">{request.dispute.reason}</div>{request.dispute.resolution && <div className="alert alert-success mt-3 mb-0">Resolution: {request.dispute.resolution}</div>}</> : <><textarea className="form-control mb-2" value={dispute} onChange={e=>setDispute(e.target.value)} placeholder="Describe a service-performance dispute" /><button className="btn btn-outline-danger" disabled={!dispute.trim() || !!busy} onClick={()=>act(`/public/requests/${request.trackingCode}/dispute`, { reason: dispute })}>Open dispute</button></>}</div></div></div></div>
  </>;
}

function ProviderGuard({ children }: { children: React.ReactNode }) { const user = JSON.parse(localStorage.getItem('fixit_user') || 'null'); if (!localStorage.getItem('fixit_token') || user?.role !== 'PROVIDER') return <Navigate to="/provider/login" replace />; return <Layout>{children}</Layout>; }
function AdminGuard({ children }: { children: React.ReactNode }) { const user = JSON.parse(localStorage.getItem('fixit_user') || 'null'); if (!localStorage.getItem('fixit_token') || user?.role !== 'SUPER_ADMIN') return <Navigate to="/provider/login" replace />; return <Layout>{children}</Layout>; }

function ProviderDashboard() {
  const [data, setData] = useState<any>(null); const [error, setError] = useState('');
  const load = () => api.get('/provider/dashboard').then(setData).catch(e => setError(e.message));
  useEffect(load, []);
  const pull = async (id: string) => { try { await api.post(`/provider/jobs/${id}/pull`, {}); load(); alert('Call assigned to your dashboard.'); } catch (e) { alert((e as Error).message); } };
  if (error) return <ProviderGuard><div className="alert alert-danger">{error}</div></ProviderGuard>;
  if (!data) return <ProviderGuard><div className="text-secondary">Loading dashboard…</div></ProviderGuard>;
  return <ProviderGuard><div className="d-flex justify-content-between align-items-center mb-4"><div><div className="text-uppercase text-secondary small fw-bold">Provider dashboard</div><h1 className="h2 fw-bold">Welcome, {data.provider.firstName}</h1></div><span className="status-pill bg-light border">KYC: {data.provider.kycStatus}</span></div>
    {data.provider.kycStatus !== 'VERIFIED' && <div className="alert alert-warning">Your account is <strong>{data.provider.kycStatus}</strong>. You cannot receive client calls until the super admin verifies your KYC.</div>}
    <div className="row g-3 mb-4">{[['Open calls',data.stats.openCalls],['Pending calls',data.stats.pendingCalls],['Closed calls',data.stats.closedCalls],['Reviews',data.stats.reviews],['Complaints / disputes',data.stats.disputes],['Resolutions',data.stats.resolutions]].map(([label,value])=><div className="col-6 col-md-4 col-xl-2" key={label as string}><div className="card soft-card h-100"><div className="card-body"><div className="small text-secondary">{label}</div><div className="metric">{value}</div></div></div></div>)}</div>
    <div className="card soft-card"><div className="card-body p-4"><h2 className="h5 fw-bold">Open call pool</h2><p className="small text-secondary">Only the currently highest-ranked eligible provider can pull a request.</p>{data.openCalls.map((c:any)=><div key={c.id} className="border rounded-4 p-3 mb-2 d-flex flex-wrap justify-content-between align-items-center gap-3"><div><div className="fw-bold">{c.category} · {c.area}</div><div className="small">{c.description}</div><div className="small text-secondary">{c.trackingCode}</div></div><button className="btn btn-dark" onClick={()=>pull(c.id)}>Pull call</button></div>)}{!data.openCalls.length && <div className="text-secondary">No open calls are currently visible.</div>}</div></div>
    <div className="d-flex gap-2 mt-3"><Link className="btn btn-outline-dark" to="/provider/jobs">My jobs</Link><Link className="btn btn-outline-secondary" to="/provider/profile">Profile / SOP / KYC</Link></div>
  </ProviderGuard>;
}

function ProviderJobs() {
  const [jobs,setJobs]=useState<any[]>([]); const [selected,setSelected]=useState<any>(null);
  const load=()=>api.get('/provider/jobs').then(setJobs).catch(e=>alert(e.message)); useEffect(load,[]);
  return <ProviderGuard><div className="row g-4"><div className="col-lg-5"><div className="card soft-card"><div className="card-body p-4"><h1 className="h4 fw-bold">My calls</h1>{jobs.map(j=><button key={j.id} onClick={()=>setSelected(j)} className="btn btn-light border text-start w-100 mb-2 p-3"><div className="fw-bold">{j.request.category} · {j.request.area}</div><div className="small">{j.request.description}</div><div className="small text-secondary">{j.status} · {j.request.trackingCode}</div></button>)}{!jobs.length&&<div className="text-secondary">No assigned calls yet.</div>}</div></div></div><div className="col-lg-7">{selected?<ProviderJobDetail job={selected} onChanged={load}/>:<div className="card soft-card"><div className="card-body p-4 text-secondary">Select a call to manage its progress.</div></div>}</div></div></ProviderGuard>;
}

function ProviderJobDetail({ job, onChanged }: { job:any; onChanged:()=>void }) {
  const [detail,setDetail]=useState<any>(null); const [note,setNote]=useState(''); const [comment,setComment]=useState(''); const [txRef,setTxRef]=useState(''); const [txAmount,setTxAmount]=useState(''); const [txType,setTxType]=useState('MATERIALS'); const [txFile,setTxFile]=useState<File|null>(null); const [disputeResponse,setDisputeResponse]=useState('');
  const load=()=>api.get(`/provider/jobs/${job.id}`).then(setDetail).catch(e=>alert(e.message)); useEffect(load,[job.id]);
  const postStatus=async(status:string)=>{try{await api.post(`/provider/jobs/${job.id}/status`,{status});await load();onChanged();}catch(e){alert((e as Error).message)}};
  const saveAudit=async()=>{try{await api.post(`/provider/jobs/${job.id}/audit`,{note});setNote('');load();}catch(e){alert((e as Error).message)}};
  const saveComment=async()=>{try{await api.post(`/provider/jobs/${job.id}/comments`,{text:comment});setComment('');load();}catch(e){alert((e as Error).message)}};
  const saveTx=async()=>{try{const fd=new FormData();fd.append('reference',txRef);fd.append('amount',txAmount);fd.append('type',txType); if(txFile)fd.append('receipt',txFile); await api.post(`/provider/jobs/${job.id}/transaction`,fd);setTxRef('');setTxAmount('');setTxFile(null);load();}catch(e){alert((e as Error).message)}};
  const respond=async()=>{try{await api.post(`/provider/jobs/${job.id}/dispute-response`,{response:disputeResponse});setDisputeResponse('');load();}catch(e){alert((e as Error).message)}};
  if(!detail)return <div className="card soft-card"><div className="card-body p-4">Loading call…</div></div>;
  return <div className="card soft-card"><div className="card-body p-4"><div className="d-flex justify-content-between gap-3"><div><div className="text-uppercase text-secondary small">{detail.job.request.category}</div><h2 className="h4 fw-bold">{detail.job.request.description}</h2><div className="small text-secondary">Client: {detail.job.request.clientName} · {detail.job.request.clientPhone} · {detail.job.request.clientEmail}</div></div><span className="status-pill bg-dark text-white">{detail.job.status}</span></div>
    <div className="d-flex flex-wrap gap-2 my-4">{detail.job.status==='ASSIGNED'&&<button className="btn btn-primary" onClick={()=>postStatus('IN_PROGRESS')}>Start job</button>}{detail.job.status==='IN_PROGRESS'&&<button className="btn btn-primary" onClick={()=>postStatus('AWAITING_COMPLETION')}>Mark ready for completion</button>}{detail.job.status==='AWAITING_COMPLETION'&&<button className="btn btn-success" onClick={()=>postStatus('COMPLETED')}>Close as completed</button>}</div>
    <div className="row g-3"><div className="col-md-6"><h3 className="h6 fw-bold">Progress audit</h3>{detail.audits.map((a:any)=><div className="timeline-item pb-3 mb-2" key={a.id}><div className="fw-semibold small">{a.event.replaceAll('_',' ')}</div><div className="small text-secondary">{new Date(a.createdAt).toLocaleString()}</div><div className="small">{a.note}</div></div>)}<textarea className="form-control" value={note} onChange={e=>setNote(e.target.value)} placeholder="Add visible job progress update" /><button className="btn btn-outline-dark mt-2" onClick={saveAudit}>Add progress update</button></div><div className="col-md-6"><h3 className="h6 fw-bold">Client conversation</h3>{detail.comments.map((c:any)=><div className="border rounded-3 p-2 mb-2 small" key={c.id}><strong>{c.authorType}</strong>: {c.text}</div>)}<textarea className="form-control" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Reply professionally" /><button className="btn btn-outline-dark mt-2" onClick={saveComment}>Post reply</button></div></div>
    <hr className="my-4"/><h3 className="h6 fw-bold">Transactions</h3><div className="small text-secondary mb-2">Every financial/material transaction should be recorded here with a reference. Receipts are optional except where your SOP requires them.</div><div className="row g-2"><div className="col-md-4"><input className="form-control" value={txRef} onChange={e=>setTxRef(e.target.value)} placeholder="Reference" /></div><div className="col-md-3"><input className="form-control" type="number" value={txAmount} onChange={e=>setTxAmount(e.target.value)} placeholder="Amount NGN" /></div><div className="col-md-3"><select className="form-select" value={txType} onChange={e=>setTxType(e.target.value)}><option>MATERIALS</option><option>OTHER</option><option>REFUND</option><option>PAYMENT_RECEIPT</option></select></div><div className="col-md-2"><input className="form-control" type="file" onChange={e=>setTxFile(e.target.files?.[0] || null)} /></div><div className="col-12"><button className="btn btn-outline-secondary" onClick={saveTx}>Record transaction</button></div></div>{detail.transactions.map((t:any)=><div key={t.id} className="border rounded-3 p-2 mt-2 small">{t.type} · {t.reference} · {t.amount ? `₦${t.amount}` : 'No amount'} · {t.notes || ''}</div>)}
    {detail.dispute && <><hr className="my-4"/><h3 className="h6 fw-bold">Dispute response</h3><div className="alert alert-warning small">{detail.dispute.reason}</div><textarea className="form-control" value={disputeResponse} onChange={e=>setDisputeResponse(e.target.value)} placeholder="Your professional response" /><button className="btn btn-outline-danger mt-2" onClick={respond}>Submit dispute response</button></>}
  </div></div>;
}

function ProviderProfile() {
  const [profile,setProfile]=useState<any>(null); const [message,setMessage]=useState(''); useEffect(()=>api.get('/provider/me').then(setProfile).catch(e=>alert(e.message)),[]);
  if(!profile)return <ProviderGuard><div>Loading profile…</div></ProviderGuard>;
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{const r=await api.put('/provider/me',fd);setMessage(r.message);const refreshed=await api.get('/provider/me');setProfile(refreshed);}catch(err){alert((err as Error).message)}};
  return <ProviderGuard><div className="card soft-card"><div className="card-body p-4 p-md-5"><div className="d-flex justify-content-between"><div><div className="text-uppercase text-secondary small">Provider profile</div><h1 className="h3 fw-bold">{profile.firstName} {profile.lastName}</h1></div><span className="status-pill bg-light border">KYC: {profile.kycStatus}</span></div>{message&&<div className="alert alert-success mt-3">{message}</div>}<form onSubmit={submit} className="row g-3 mt-1"><TextArea label="Bio" name="bio" defaultValue={profile.bio||''}/><TextArea label="Qualifications" name="qualifications" defaultValue={profile.qualifications}/><TextArea label="References" name="references" defaultValue={profile.references||''}/><TextArea label="Public SOP" name="sop" defaultValue={profile.sop}/><Field label="Categories" name="categories" defaultValue={profile.categories.join(',')}/><Field label="Service areas" name="serviceAreas" defaultValue={profile.serviceAreas.join(',')}/><div className="col-12"><label className="form-label fw-semibold">Replace / upload KYC document</label><input className="form-control" type="file" name="kycDocument" accept=".pdf,.png,.jpg,.jpeg,.webp"/></div><div className="col-12"><button className="btn btn-dark">Save profile</button></div></form></div></div></ProviderGuard>;
}

function AdminDashboard() {
  const [stats,setStats]=useState<any>(null); const [providers,setProviders]=useState<any[]>([]); const [requests,setRequests]=useState<any[]>([]); const [selected,setSelected]=useState<any>(null); const load=()=>Promise.all([api.get('/admin/stats'),api.get('/admin/providers'),api.get('/admin/requests')]).then(([s,p,r])=>{setStats(s);setProviders(p);setRequests(r);}).catch(e=>alert(e.message)); useEffect(load,[]);
  const openProvider=(id:string)=>api.get(`/admin/providers/${id}`).then(setSelected).catch(e=>alert(e.message));
  if(!stats)return <AdminGuard><div>Loading admin console…</div></AdminGuard>;
  return <AdminGuard><div className="d-flex justify-content-between align-items-center mb-4"><div><div className="text-uppercase text-secondary small fw-bold">Super admin</div><h1 className="h2 fw-bold">FIX it control room</h1></div><span className="status-pill bg-dark text-white">Provider governance</span></div>
    <div className="row g-3 mb-4">{Object.entries(stats).map(([k,v])=><div className="col-6 col-md-3" key={k}><div className="card soft-card"><div className="card-body"><div className="small text-secondary">{k.replaceAll('_',' ')}</div><div className="metric">{String(v)}</div></div></div></div>)}</div>
    <div className="row g-4"><div className="col-lg-5"><div className="card soft-card"><div className="card-body p-4"><h2 className="h5 fw-bold">Provider vetting</h2>{providers.map(p=><button key={p.id} onClick={()=>openProvider(p.id)} className="btn btn-light border text-start w-100 mb-2 p-3"><div className="d-flex justify-content-between"><strong>{p.name}</strong><span className="status-pill bg-light border">{p.kycStatus}</span></div><div className="small text-secondary">{p.categories.join(' · ')} · {p.rating || 'New'}★</div></button>)}</div></div></div><div className="col-lg-7">{selected?<AdminProviderDetail data={selected} onReload={()=>openProvider(selected.provider.id)}/>:<div className="card soft-card"><div className="card-body p-4 text-secondary">Select a provider to inspect KYC, jobs, reviews, disputes, comments, transactions and audit events.</div></div>}</div></div>
    <div className="card soft-card mt-4"><div className="card-body p-4"><h2 className="h5 fw-bold">All service requests</h2><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Tracking</th><th>Category</th><th>Area</th><th>Status</th><th>Provider</th><th>Client</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td>{r.trackingCode}</td><td>{r.category}</td><td>{r.area}</td><td>{r.status}</td><td>{r.provider||'Unassigned'}</td><td>{r.clientName}<div className="small text-secondary">{r.clientPhone}</div></td></tr>)}</tbody></table></div></div></div>
  </AdminGuard>;
}

function AdminProviderDetail({data,onReload}:{data:any;onReload:()=>void}) {
  const openKyc = async () => { try { const token = localStorage.getItem('fixit_token'); const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'; const r = await fetch(`${base}/admin/providers/${data.provider.id}/kyc-document`, { headers: { Authorization: `Bearer ${token}` } }); if (!r.ok) throw new Error('KYC document could not be opened'); const blob = await r.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { alert((e as Error).message); } };
  const [message,setMessage]=useState(''); const [resolution,setResolution]=useState(''); const verify=async(status:string)=>{try{await api.post(`/admin/providers/${data.provider.id}/verify`,{status});onReload();}catch(e){alert((e as Error).message)}}; const interject=async(requestId:string)=>{if(!message.trim())return;try{await api.post(`/admin/requests/${requestId}/interject`,{message});setMessage('');alert('Interjection posted');onReload();}catch(e){alert((e as Error).message)}}; const resolve=async(requestId:string)=>{if(!resolution.trim())return;try{await api.post(`/admin/requests/${requestId}/resolve-dispute`,{resolution});setResolution('');onReload();}catch(e){alert((e as Error).message)}};
  return <div className="card soft-card"><div className="card-body p-4"><div className="d-flex justify-content-between gap-2"><div><h2 className="h4 fw-bold">{data.provider.firstName} {data.provider.lastName}</h2><div className="small text-secondary">{data.provider.email} · {data.provider.phone}</div></div><div className="d-flex gap-2"><button className="btn btn-success btn-sm" onClick={()=>verify('VERIFIED')}>Verify KYC</button><button className="btn btn-outline-danger btn-sm" onClick={()=>verify('REJECTED')}>Reject KYC</button></div></div><div className="mt-3"><div className="small text-secondary">KYC status</div><strong>{data.provider.kycStatus}</strong>{data.provider.kycDocumentPath&&<div className="small mt-1 d-flex gap-2 align-items-center">KYC file stored on server: {data.provider.kycDocumentPath} <button className="btn btn-sm btn-outline-secondary" onClick={openKyc}>Open KYC</button></div>}</div><hr/><h3 className="h6 fw-bold">Provider profile</h3><p>{data.provider.bio}</p><div className="small"><strong>Qualifications:</strong> {data.provider.qualifications}</div><div className="small mt-2"><strong>SOP:</strong> {data.provider.sop}</div><div className="small mt-2"><strong>Service areas:</strong> {data.provider.serviceAreas.join(', ')}</div><hr/><h3 className="h6 fw-bold">Jobs & interaction history</h3>{data.jobs.map((j:any)=><div className="border rounded-4 p-3 mb-3" key={j.id}><div className="fw-bold">{j.request.trackingCode} · {j.request.category} · {j.status}</div><div className="small text-secondary">Client: {j.request.clientName} · {j.request.clientPhone}</div><div className="mt-2"><textarea className="form-control form-control-sm" placeholder="Admin interjection" value={message} onChange={e=>setMessage(e.target.value)} /><button className="btn btn-sm btn-outline-dark mt-2" onClick={()=>interject(j.requestId)}>Interject in this job</button></div>{data.disputes.filter((d:any)=>d.requestId===j.requestId).map((d:any)=><div key={d.id} className="alert alert-warning mt-3 mb-0"><strong>Dispute:</strong> {d.reason}<div className="small mt-2">Status: {d.status}</div>{d.status==='OPEN'&&<><textarea className="form-control form-control-sm mt-2" placeholder="Admin resolution" value={resolution} onChange={e=>setResolution(e.target.value)} /><button className="btn btn-sm btn-success mt-2" onClick={()=>resolve(j.requestId)}>Resolve dispute</button></>}</div>)}</div>)}<hr/><h3 className="h6 fw-bold">Reviews</h3>{data.reviews.map((r:any)=><div key={r.id} className="small mb-2">{r.emoji} {r.rating}/5 — {r.comment}</div>)}<h3 className="h6 fw-bold mt-4">Recent audit entries</h3>{data.audits.slice(0,30).map((a:any)=><div key={a.id} className="small border-bottom py-2"><strong>{a.event}</strong> · {a.note}</div>)}</div></div>;
}

function Field({ label, name, type='text', required=false, help, defaultValue }: { label:string; name:string; type?:string; required?:boolean; help?:string; defaultValue?:string }) { return <div className="col-md-6"><label className="form-label fw-semibold">{label}</label><input className="form-control" name={name} type={type} required={required} defaultValue={defaultValue}/>{help&&<div className="form-text">{help}</div>}</div>; }
function TextArea({ label, name, required=false, help, defaultValue }: { label:string; name:string; required?:boolean; help?:string; defaultValue?:string }) { return <div className="col-12"><label className="form-label fw-semibold">{label}</label><textarea className="form-control" name={name} required={required} defaultValue={defaultValue}/>{help&&<div className="form-text">{help}</div>}</div>; }
function Select({ label, name, options, required=false }: { label:string; name:string; options:string[]; required?:boolean }) { return <div className="col-md-6"><label className="form-label fw-semibold">{label}</label><select className="form-select" name={name} required={required}><option value="">Select…</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>; }

export function App() {
  return <Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/request" element={<RequestPage/>}/>
    <Route path="/track" element={<TrackPage/>}/>
    <Route path="/track/:code" element={<TrackRoute/>}/>
    <Route path="/provider/register" element={<ProviderRegister/>}/>
    <Route path="/provider/login" element={<ProviderLogin/>}/>
    <Route path="/provider" element={<ProviderDashboard/>}/>
    <Route path="/provider/jobs" element={<ProviderJobs/>}/>
    <Route path="/provider/profile" element={<ProviderProfile/>}/>
    <Route path="/admin" element={<AdminDashboard/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}

function TrackRoute(){ const code = useLocation().pathname.split('/').pop() || ''; return <TrackPage initialCode={code}/>; }
