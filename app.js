let adminChannel=null,currentApplication=null,lastPendingTotal=0;

const $=id=>document.getElementById(id);
function toast(m){const t=$("toast");if(!t)return;t.textContent=m;t.style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>t.style.display="none",2200)}
function go(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$(id)?.classList.add("active")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

window.KB_AUTH_CONFIG={appRole:"management",socialProviders:["google"],phoneOtpReady:false};

function kbAuthReady(){return window.KOPI_SUPABASE_READY&&typeof supabase!=="undefined";}
async function kbGetUser(){
  if(!kbAuthReady())return null;
  const {data:{user},error}=await supabase.auth.getUser();
  if(error)return null;
  return user||null;
}
function openManagementAuth(){
  const o=$("kbAuthOverlay");
  if(o)o.classList.remove("hidden");
}
function kbCloseAuth(){$("kbAuthOverlay")?.classList.add("hidden");}
async function kbSignIn(provider){
  if(provider!=="google")return toast("Google is the management login method.");
  if(!kbAuthReady())return toast("Database not connected");

  // Mark this navigation as an OAuth callback so the dashboard can open
  // automatically only after Google authentication returns.
  const redirectTo=window.location.origin+window.location.pathname+"?auth=callback";
  const {error}=await supabase.auth.signInWithOAuth({
    provider:"google",
    options:{
      redirectTo,
      queryParams:{prompt:"select_account"}
    }
  });
  if(error)toast(error.message);
}
async function session(){
  if(!kbAuthReady()){toast("Database not connected");return null;}
  const {data:{session},error}=await supabase.auth.getSession();
  if(error){toast("Authentication check failed");return null;}
  return session||null;
}

async function enterManagement(){
  const user=await kbGetUser();
  if(!user)return openManagementAuth();
  await enterDashboard(user);
}

async function enterDashboard(user){
  kbCloseAuth();
  $("login").classList.remove("active");
  $("dashboard").classList.add("active");
  await refreshAll();
  subscribe();
}

function showTab(tab,btn){
  ["applications","orders","partners"].forEach(x=>$(x+"Tab")?.classList.toggle("hidden",x!==tab));
  document.querySelectorAll(".admin-tabs button").forEach(x=>x.classList.remove("active"));
  btn?.classList.add("active");
}

async function refreshAll(){
  if(!(await session()))return;
  await Promise.all([loadStats(),loadApplications(),loadOrders(),loadPartners()]);
}

async function loadStats(){
  const [ca,ra,c,r,o]=await Promise.all([
    supabase.from("cook_applications").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabase.from("rider_applications").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabase.from("merchants").select("id",{count:"exact",head:true}).eq("status","approved").eq("active",true),
    supabase.from("riders").select("id",{count:"exact",head:true}).eq("status","approved").eq("active",true),
    supabase.from("orders").select("id,status,created_at")
  ]);
  $("pendingCooks").textContent=ca.count||0;
  $("pendingRiders").textContent=ra.count||0;
  $("approvedCooks").textContent=c.count||0;
  $("approvedRiders").textContent=r.count||0;
  const orders=o.data||[],today=new Date().toISOString().slice(0,10);
  $("activeOrders").textContent=orders.filter(x=>!["delivered","cancelled","declined"].includes(x.status)).length;
  $("todayOrders").textContent=orders.filter(x=>x.created_at?.startsWith(today)).length;
}

function appCard(type,x){
  const cook=type==="cook";
  const title=cook?(x.display_name||x.full_name):x.full_name;
  const sub=cook?`${x.full_name} · ${x.phone}`:`${x.phone} · ${x.vehicle_type||"Rider"}`;
  const area=cook?`${x.food_type||"Cook"} · ${x.service_area||"--"}`:`Area: ${x.operating_area||"--"}`;
  return `<div class="admin-card">
    <b>${esc(title)}</b>
    <small>${esc(sub)}</small>
    <small>${esc(area)}</small>
    <div class="card-actions">
      <button class="orange" onclick="openApplication('${type}','${x.id}')">VIEW</button>
      <button class="green" onclick="approveApplication('${type}','${x.id}')">APPROVE</button>
      <button class="decline" onclick="rejectApp('${type}','${x.id}')">REJECT</button>
    </div>
  </div>`;
}

async function loadApplications(){
  const [c,r]=await Promise.all([
    supabase.from("cook_applications").select("*").eq("status","pending").order("created_at",{ascending:false}),
    supabase.from("rider_applications").select("*").eq("status","pending").order("created_at",{ascending:false})
  ]);
  const cooks=c.data||[],riders=r.data||[],total=cooks.length+riders.length;
  $("cookApps").innerHTML=cooks.length?cooks.map(x=>appCard("cook",x)).join(""):"<div class='empty-state'>No pending cook applications.</div>";
  $("riderApps").innerHTML=riders.length?riders.map(x=>appCard("rider",x)).join(""):"<div class='empty-state'>No pending rider applications.</div>";
  $("newApplicationBanner").classList.toggle("hidden",total===0);
  $("newApplicationText").textContent=total?`${total} application${total===1?"":"s"} waiting for your review.`:"";
  if(total>lastPendingTotal&&lastPendingTotal>=0)toast("🔔 New partner application");
  lastPendingTotal=total;
}

async function fetchApplication(type,id){
  const table=type==="cook"?"cook_applications":"rider_applications";
  const {data,error}=await supabase.from(table).select("*").eq("id",id).single();
  if(error)return null;
  return data;
}

function openApplication(type,id){
  fetchApplication(type,id).then(a=>{
    if(!a)return toast("Application not found");
    currentApplication={type,id,data:a};
    $("modalTitle").textContent=type==="cook"?"Cook Application":"Rider Application";
    const rows=type==="cook"?[
      ["Full name",a.full_name],["Display / kitchen name",a.display_name],["Phone",a.phone],
      ["Food type",a.food_type],["Service area",a.service_area],["Postal codes",a.service_postal_codes],
      ["Operating hours",`${a.operating_start||"--"} – ${a.operating_end||"--"}`],
      ["Daily capacity",a.daily_capacity],["SFA licensed",a.sfa_licensed?"Yes":"No"],
      ["SFA licence number",a.sfa_licence_number||"Not provided"],["Bio",a.bio||"--"],
      ["Acknowledgement",a.compliance_ack?"Accepted":"Not accepted"]
    ]:[
      ["Full name",a.full_name],["Phone",a.phone],["Vehicle",a.vehicle_type],
      ["Operating area",a.operating_area],["Acknowledgement",a.compliance_ack?"Accepted":"Not accepted"],
      ["Eligibility acknowledgement",a.eligibility_ack?"Accepted":"Not accepted"]
    ];
    $("modalBody").innerHTML=rows.map(([k,v])=>`<div style="margin:.45rem 0"><small>${esc(k)}</small><br><b>${esc(v)}</b></div>`).join("");
    $("modalApprove").onclick=()=>approveApplication(type,id);
    $("modalReject").onclick=()=>rejectApp(type,id);
    $("applicationModal").classList.remove("hidden");
  });
}
function closeApplicationModal(){currentApplication=null;$("applicationModal").classList.add("hidden");}

async function approveApplication(type,id){
  const table=type==="cook"?"cook_applications":"rider_applications";
  const {data:a,error}=await supabase.from(table).select("*").eq("id",id).single();
  if(error)return toast(error.message);
  if(a.status!=="pending")return toast("Application is no longer pending");

  let createdId=null,createError=null;
  if(type==="cook"){
    const {data,error:e}=await supabase.from("merchants").insert({
      name:a.display_name||a.full_name,type:a.food_type||"Local Food",bio:a.bio||"",
      operating_start:a.operating_start,operating_end:a.operating_end,
      order_open:a.operating_start,order_close:a.operating_end,
      daily_capacity:a.daily_capacity||20,status:"approved",active:true,menu_live:true,
      user_id:a.user_id||null,email:a.email||null
    }).select("id").single();
    createdId=data?.id;createError=e;
  }else{
    const {data,error:e}=await supabase.from("riders").insert({
      name:a.full_name,phone:a.phone,vehicle_type:a.vehicle_type,
      operating_area:a.operating_area,status:"approved",active:true,
      user_id:a.user_id||null,email:a.email||null
    }).select("id").single();
    createdId=data?.id;createError=e;
  }
  if(createError)return toast(createError.message);

  const now=new Date().toISOString();
  // Link the application back to the real cook/rider row that was just
  // created, using the actual column names (merchant_id / rider_id).
  const linkPatch={status:"approved",approved_at:now};
  if(type==="cook")linkPatch.merchant_id=createdId;else linkPatch.rider_id=createdId;
  const {error:updateError}=await supabase.from(table).update(linkPatch).eq("id",id);
  if(updateError){
    toast(updateError.message);
    return;
  }

  // Notify the partner — written to the real recipient_user_id/recipient_email
  // columns so the Partner app's inbox actually picks it up.
  try{
    await supabase.from("partner_notifications").insert({
      application_id:id,partner_type:type,
      recipient_user_id:a.user_id||null,recipient_email:a.email||null,
      title:"🎉 Welcome to Kopi Boy!",
      message:type==="cook"
        ?"Your Cook Partner application has been approved. Your profile is now active and you're ready to prepare your menu and receive orders. Welcome to the Kopi Boy family! ❤️"
        :"Your Rider Partner application has been approved. Your account is now active and you're ready to accept delivery jobs. Welcome to the Kopi Boy family! ❤️",
      read:false,created_at:now
    });
  }catch(_){}

  closeApplicationModal();
  toast(type==="cook"?"🎉 Cook approved!":"🎉 Rider approved!");
  await refreshAll();
}

async function rejectApp(type,id){
  if(!confirm("Reject this application?"))return;
  const table=type==="cook"?"cook_applications":"rider_applications";
  const {data:a,error:fetchError}=await supabase.from(table).select("*").eq("id",id).single();
  if(fetchError)return toast(fetchError.message);
  const now=new Date().toISOString();
  const {error}=await supabase.from(table).update({status:"rejected",rejected_at:now}).eq("id",id);
  if(error)return toast(error.message);

  try{
    await supabase.from("partner_notifications").insert({
      application_id:id,partner_type:type,
      recipient_user_id:a.user_id||null,recipient_email:a.email||null,
      title:"Application update",
      message:type==="cook"
        ?"Your Cook Partner application was not approved this time. Contact Kopi Boy support if you'd like to know more, or you're welcome to reapply."
        :"Your Rider Partner application was not approved this time. Contact Kopi Boy support if you'd like to know more, or you're welcome to reapply.",
      read:false,created_at:now
    });
  }catch(_){}

  closeApplicationModal();
  toast("Application rejected");
  await refreshAll();
}

async function loadOrders(){
  const {data}=await supabase.from("orders").select("*").order("created_at",{ascending:false}).limit(50);
  $("orders").innerHTML=data?.length?data.map(o=>`<div class="admin-card"><b>${esc(o.order_number)}</b><span class="status-pill ${o.status}">${esc(o.status)}</span><small>Cook: ${esc(o.merchant_name||o.merchant_id||"--")}</small><small>Rider: ${esc(o.rider_name||"Not assigned")}</small><small>Total: S$${Number(o.total||0).toFixed(2)}</small><small>${o.created_at?new Date(o.created_at).toLocaleString():""}</small></div>`).join(""):"<div class='empty-state'>No orders yet.</div>";
}

async function loadPartners(){
  const [c,r,o]=await Promise.all([
    supabase.from("merchants").select("*").eq("status","approved").order("name"),
    supabase.from("riders").select("*").eq("status","approved").order("name"),
    supabase.from("orders").select("merchant_id,rider_id,status,total,created_at")
  ]);
  const orders=o.data||[];
  const today=new Date().toISOString().slice(0,10);

  function cookStats(id){
    const mine=orders.filter(x=>x.merchant_id===id);
    const completed=mine.filter(x=>x.status==="delivered");
    const today_count=mine.filter(x=>x.created_at?.startsWith(today)).length;
    return `${mine.length} orders total · ${today_count} today · $${completed.reduce((s,x)=>s+Number(x.total||0),0).toFixed(2)} completed`;
  }
  function riderStats(id){
    const mine=orders.filter(x=>x.rider_id===id);
    const delivered=mine.filter(x=>x.status==="delivered");
    const today_count=mine.filter(x=>x.created_at?.startsWith(today)).length;
    return `${mine.length} jobs total · ${today_count} today · ${delivered.length} delivered`;
  }

  $("cookPartners").innerHTML=c.data?.length?c.data.map(x=>`<div class="partner-row"><span>👨‍🍳</span><div><b>${esc(x.name)}</b><small>${esc(x.type||"Cook")} · ${x.active?"Active":"Inactive"}</small><small>${cookStats(x.id)}</small></div><div class="partner-actions"><button class="pause" onclick="togglePartner('merchants','${x.id}',${!x.active})">${x.active?"Disable":"Enable"}</button><button class="danger" onclick="removePartner('merchants','${x.id}','${esc(x.name)}')">Remove</button></div></div>`).join(""):"<div class='empty-state'>No approved cooks.</div>";
  $("riderPartners").innerHTML=r.data?.length?r.data.map(x=>`<div class="partner-row"><span>🛵</span><div><b>${esc(x.name)}</b><small>${esc(x.vehicle_type||"Rider")} · ${esc(x.operating_area||"--")}</small><small>${riderStats(x.id)}</small></div><div class="partner-actions"><button class="pause" onclick="togglePartner('riders','${x.id}',${!x.active})">${x.active?"Disable":"Enable"}</button><button class="danger" onclick="removePartner('riders','${x.id}','${esc(x.name)}')">Remove</button></div></div>`).join(""):"<div class='empty-state'>No approved riders.</div>";
}
async function togglePartner(table,id,active){
  const {error}=await supabase.from(table).update({active}).eq("id",id);
  if(error)return toast(error.message);
  await refreshAll();toast(active?"Partner enabled":"Partner disabled");
}
async function removePartner(table,id,name){
  if(!confirm("Remove "+(name||"this partner")+"? They'll be kicked out of Kopi Boy and will need to reapply to come back."))return;

  // Don't hard-delete the merchants/riders row — if they have any order or
  // menu history, that would violate the database's referential integrity
  // (that's the popup you saw on the cook). Instead, mark them removed and
  // deactivate, which keeps historical records intact but excludes them
  // from every "approved" listing everywhere in the app.
  const {error:updateError}=await supabase.from(table).update({status:"removed",active:false}).eq("id",id);
  if(updateError)return toast(updateError.message);

  // Delete their application record entirely so the next time they try to
  // log in, the app finds nothing on file and sends them to a fresh apply
  // form — exactly like a brand new applicant, not a "pending review" screen.
  const appTable=table==="merchants"?"cook_applications":"rider_applications";
  const linkColumn=table==="merchants"?"merchant_id":"rider_id";
  const {error:appDeleteError}=await supabase.from(appTable).delete().eq(linkColumn,id);
  if(appDeleteError){toast(appDeleteError.message);}

  await refreshAll();toast("Partner removed — they'll need to reapply");
}
function subscribe(){
  if(adminChannel)supabase.removeChannel(adminChannel);
  adminChannel=supabase.channel("management-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"cook_applications"},refreshAll)
    .on("postgres_changes",{event:"*",schema:"public",table:"rider_applications"},refreshAll)
    .on("postgres_changes",{event:"*",schema:"public",table:"orders"},refreshAll)
    .subscribe();
}

document.addEventListener("DOMContentLoaded",async()=>{
  if(!kbAuthReady())return;

  const params=new URLSearchParams(window.location.search);
  const isOAuthCallback=params.get("auth")==="callback";
  const user=await kbGetUser();

  // IMPORTANT:
  // Opening the Management URL must show Google login first.
  // An old browser session must never silently bypass the login screen.
  if(isOAuthCallback && user){
    // Clean the callback flag after Supabase has restored the session.
    window.history.replaceState({},document.title,window.location.pathname);
    enterDashboard(user);
  }else{
    go("login");
  }

  supabase.auth.onAuthStateChange((event,session)=>{
    // Only enter automatically for a real sign-in event.
    if(event==="SIGNED_IN"&&session?.user){
      const callback=new URLSearchParams(window.location.search).get("auth")==="callback";
      if(callback){
        window.history.replaceState({},document.title,window.location.pathname);
        enterDashboard(session.user);
      }
    }
    if(event==="SIGNED_OUT")go("login");
  });
});
