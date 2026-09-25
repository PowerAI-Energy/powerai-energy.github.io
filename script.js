const menuToggle=document.querySelector('.menu-toggle'),navLinks=document.querySelector('#nav-links');
menuToggle?.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open))});
document.querySelectorAll('#nav-links a').forEach(link=>link.addEventListener('click',()=>{navLinks?.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false')}));
const year=document.querySelector('#year'); if(year) year.textContent=new Date().getFullYear();

const $=id=>document.getElementById(id);
const fmtNumber=(value,digits=2)=>new Intl.NumberFormat('es-CO',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const tickerTrack=$('ticker-track');

async function loadExchangeRates(){
  try{
    const response=await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=COP,EUR,GBP',{cache:'no-store'});
    if(!response.ok) throw new Error('exchange api');
    const rows=await response.json();
    const map={}; rows.forEach(r=>map[r.quote]=r.rate);
    if(map.COP) $('fx-usd').textContent=fmtNumber(map.COP,2)+' COP';
    if(map.EUR) {
      const eurCop=map.COP/map.EUR;
      $('fx-eur').textContent=fmtNumber(eurCop,2)+' COP';
    }
    if(map.GBP) {
      const gbpCop=map.COP/map.GBP;
      $('fx-gbp').textContent=fmtNumber(gbpCop,2)+' COP';
    }
  }catch(e){
    $('fx-usd').textContent='No disponible';
    $('fx-eur').textContent='No disponible';
    $('fx-gbp').textContent='No disponible';
  }
}

let weatherRefreshTimer=null;
function openLocationModal(){const m=$('location-modal'); if(!m)return; m.classList.add('open'); m.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open')}
function closeLocationModal(){const m=$('location-modal'); if(!m)return; m.classList.remove('open'); m.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open')}
function setWeatherText(message){$('weather-summary').textContent=message}
function weatherIcon(symbol=''){const s=symbol.toLowerCase(); if(s.includes('rain')||s.includes('shower')) return '☔'; if(s.includes('snow')) return '❄'; if(s.includes('thunder')) return '⛈'; if(s.includes('cloud')) return '☁'; if(s.includes('clear')) return '☀'; return '◌'}
function findCurrentSeries(data){
  const series=data?.properties?.timeseries||[];
  if(!series.length)return null;
  const now=Date.now();
  return [...series].sort((a,b)=>Math.abs(new Date(a.time).getTime()-now)-Math.abs(new Date(b.time).getTime()-now))[0];
}
async function updateLocalWeather(lat,lon){
  setWeatherText('Consultando…');
  try{
    const [geoRes,weatherRes]=await Promise.all([
      fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&localityLanguage=es',{cache:'no-store'}),
      fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon),{cache:'no-store'})
    ]);
    if(!geoRes.ok||!weatherRes.ok) throw new Error('weather request failed');
    const geo=await geoRes.json();
    const weather=await weatherRes.json();
    const point=findCurrentSeries(weather);
    const d=point?.data?.instant?.details||{};
    const summary=point?.data?.next_1_hours?.summary?.symbol_code||point?.data?.next_6_hours?.summary?.symbol_code||'';
    const city=geo.city||geo.locality||geo.principalSubdivision||'Ubicación local';
    const country=geo.countryName||'';
    const altitude=Array.isArray(weather.geometry?.coordinates)&&weather.geometry.coordinates.length>2?weather.geometry.coordinates[2]:null;
    $('weather-summary').textContent=weatherIcon(summary)+' '+city+(country?', '+country:'');
    $('weather-temp').textContent=Number.isFinite(d.air_temperature)?d.air_temperature.toFixed(1)+' °C':'—';
    $('weather-humidity').textContent=Number.isFinite(d.relative_humidity)?Math.round(d.relative_humidity)+' %':'—';
    $('weather-wind').textContent=Number.isFinite(d.wind_speed)?d.wind_speed.toFixed(1)+' m/s':'—';
    $('weather-altitude').textContent=Number.isFinite(altitude)?Math.round(altitude)+' m s. n. m.':'—';
    const pressure=Number.isFinite(d.air_pressure_at_sea_level)?Math.round(d.air_pressure_at_sea_level)+' hPa':'';
    const gust=Number.isFinite(d.wind_speed_of_gust)?' · racha '+d.wind_speed_of_gust.toFixed(1)+' m/s':'';
    const clouds=Number.isFinite(d.cloud_area_fraction)?' · nubosidad '+Math.round(d.cloud_area_fraction)+' %':'';
    const extra=document.getElementById('weather-extra');
    if(extra) extra.textContent='Presión '+pressure+gust+clouds;
    localStorage.setItem('powerai_weather_consent','granted');
    if(weatherRefreshTimer) clearTimeout(weatherRefreshTimer);
    weatherRefreshTimer=setTimeout(()=>updateLocalWeather(lat,lon),15*60*1000);
  }catch(e){
    setWeatherText('No disponible');
  }
}
function requestLocation(){
  if(!navigator.geolocation){setWeatherText('Geolocalización no disponible'); return}
  setWeatherText('Solicitando ubicación…');
  navigator.geolocation.getCurrentPosition(
    pos=>updateLocalWeather(pos.coords.latitude,pos.coords.longitude),
    ()=>setWeatherText('Ubicación no autorizada'),
    {enableHighAccuracy:false,timeout:10000,maximumAge:10*60*1000}
  );
}
$('location-button')?.addEventListener('click',openLocationModal);
$('location-close')?.addEventListener('click',closeLocationModal);
$('location-deny')?.addEventListener('click',closeLocationModal);
$('location-allow')?.addEventListener('click',()=>{closeLocationModal();requestLocation()});
$('location-modal')?.addEventListener('click',e=>{if(e.target.id==='location-modal')closeLocationModal()});

loadExchangeRates();
setInterval(loadExchangeRates,6*60*60*1000);

try{
  if(localStorage.getItem('powerai_weather_consent')==='granted'){
    const last=localStorage.getItem('powerai_weather_coords');
    if(last){const p=JSON.parse(last); if(Number.isFinite(p.lat)&&Number.isFinite(p.lon)) updateLocalWeather(p.lat,p.lon)}
  }
}catch(e){}

// Save only non-identifying coordinates for this browser session/storage when permission was granted.
setTimeout(()=>{
  try{
    if(!localStorage.getItem('powerai_weather_consent')) openLocationModal();
  }catch(e){openLocationModal()}
},2200);

const originalUpdate=updateLocalWeather;
updateLocalWeather=async function(lat,lon){
  try{localStorage.setItem('powerai_weather_coords',JSON.stringify({lat:Number(lat).toFixed(4),lon:Number(lon).toFixed(4)}));}catch(e){}
  return originalUpdate(lat,lon);
}

const CONTACT_FORM=document.querySelector('#contact-form');
CONTACT_FORM?.addEventListener('submit',()=>{
  const d=new FormData(CONTACT_FORM);
  try{sessionStorage.setItem('powerai_contact_pending',JSON.stringify({nombre:d.get('nombre')||'',empresa:d.get('empresa')||'',email:d.get('email')||'',tension:d.get('tension')||'',servicio:d.get('servicio')||'',mensaje:d.get('mensaje')||''}))}catch(e){}
});
