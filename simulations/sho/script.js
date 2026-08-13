// Simple Harmonic Oscillator demo - vertical spring version

function $(id){return document.getElementById(id)}

// Parameters and state
let mass = parseFloat($('mass').value)
let k = parseFloat($('k').value)
let amp = parseFloat($('amp').value)
let gamma = parseFloat($('gamma').value)
let dt_ms = parseFloat($('dt').value)

let t = 0
let x = amp        // x is displacement in meters; positive = downward
let v = 0
let running = false
let raf = null

// Canvas setup
const animC = $('animCanvas')
const actx = animC.getContext('2d')
const specC = $('specCanvas')
const sctx = specC.getContext('2d')

// Data buffer for FFT
let buffer = []
const MAX_SAMPLES = 32768

// Hook up controls (range + number sync)
function bindRange(rangeId, numId, onChange){
  const r = $(rangeId), n = $(numId)
  r.addEventListener('input', ()=>{ n.value = r.value; onChange(r.value) })
  n.addEventListener('change', ()=>{ r.value = n.value; onChange(n.value) })
}
bindRange('mass','massNum', v=> mass = parseFloat(v))
bindRange('k','kNum', v=> k = parseFloat(v))
bindRange('amp','ampNum', v=> { amp = parseFloat(v); if(!running){ x = amp; drawAnim() }})
bindRange('gamma','gammaNum', v=> gamma = parseFloat(v))
bindRange('dt','dtNum', v=> dt_ms = parseFloat(v))

$('start').addEventListener('click', ()=> { if(!running){ running=true; loop() }})
$('pause').addEventListener('click', ()=> { running=false; if(raf) cancelAnimationFrame(raf) })
$('reset').addEventListener('click', ()=> { running=false; if(raf) cancelAnimationFrame(raf); t=0; x=amp; v=0; buffer=[]; drawAnim(); clearSpec() })
$('computeSpectrum').addEventListener('click', ()=> computeAndDrawSpectrum())

// Physics integrator: velocity Verlet style for stability
function step(dt){
  const a = (-k*x - gamma*v)/mass
  v += a*dt
  x += v*dt
  t += dt
  buffer.push(x)
  if(buffer.length > MAX_SAMPLES) buffer.shift()
}

// Drawing helpers for vertical spring
function drawSpring(ctx, x0, y0, x1, y1, coils=12, amp=10){
  // Draw a zigzag spring from (x0,y0) to (x1,y1)
  const dx = x1 - x0
  const dy = y1 - y0
  const length = Math.hypot(dx, dy)
  const ux = dx / length
  const uy = dy / length
  // perpendicular vector
  const px = -uy
  const py = ux
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  const step = length / coils
  for(let i=1;i<=coils;i++){
    const t = i / coils
    const baseX = x0 + ux * (t * length)
    const baseY = y0 + uy * (t * length)
    const sign = (i % 2 === 0) ? 1 : -1
    const sx = baseX + px * (amp * sign)
    const sy = baseY + py * (amp * sign)
    ctx.lineTo(sx, sy)
  }
  ctx.stroke()
}

// Animation and drawing
function drawAnim(){
  const W = animC.width, H = animC.height
  actx.clearRect(0,0,W,H)

  // ceiling position
  const cx = W/2
  const ceilingY = 20

  // map physical displacement x (meters) to pixels
  // choose a scale so that amplitude ~ half canvas height by default
  const scale = Math.max(40, (H-120)/2) // pixels per meter
  const equilibriumY = H/2  // equilibrium position in pixels
  const massY = equilibriumY + x * scale

  // draw ceiling
  actx.fillStyle = '#9aa6b2'
  actx.fillRect(cx-60, ceilingY-6, 120, 6)

  // draw spring
  actx.strokeStyle = '#4fd1c5'
  actx.lineWidth = 3
  drawSpring(actx, cx, ceilingY, cx, massY-30, 18, 8)

  // draw mass as rounded rectangle
  const mw = 80, mh = 50
  const mx = cx - mw/2
  const my = massY - mh/2
  actx.fillStyle = '#4fd1c5'
  roundRect(actx, mx, my, mw, mh, 8, true, false)
  // add a small shadow
  actx.fillStyle = 'rgba(0,0,0,0.12)'
  actx.fillRect(mx+6, my+mh-6, mw-12, 6)

  // labels
  $('timeLabel').textContent = t.toFixed(2)
  $('posLabel').textContent = x.toFixed(3)
}

// rounded rectangle helper
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (typeof r === 'undefined') r = 5
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  if(fill) ctx.fill()
  if(stroke) ctx.stroke()
}

// Spectrum drawing helpers (unchanged from previous)
function clearSpec(){
  sctx.clearRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#071021'
  sctx.fillRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#9aa6b2'
  sctx.fillText('Spectrum will appear here after computing', 10, 20)
}

function fft(re, im){
  const n = re.length
  if(n <= 1) return
  const levels = Math.log2(n)
  if(Math.floor(levels) !== levels) throw 'FFT size must be power of 2'
  for(let i=0;i<n;i++){
    let j = 0, bit = i
    for(let k=0;k<levels;k++){
      j = (j<<1) | (bit & 1)
      bit >>= 1
    }
    if(j > i){ [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for(let size=2; size<=n; size<<=1){
    const half = size/2
    const theta = -2*Math.PI/size
    const wpr = Math.cos(theta), wpi = Math.sin(theta)
    for(let i=0;i<n;i+=size){
      let wr = 1, wi = 0
      for(let j=0;j<half;j++){
        const k = i+j
        const l = k+half
        const tr = wr*re[l] - wi*im[l]
        const ti = wr*im[l] + wi*re[l]
        re[l] = re[k] - tr
        im[l] = im[k] - ti
        re[k] += tr
        im[k] += ti
        const tmp = wr
        wr = tmp*wpr - wi*wpi
        wi = tmp*wpi + wi*wpr
      }
    }
  }
}

function computeAndDrawSpectrum(){
  if(buffer.length < 64){ alert('Collect more samples by running the simulation for a bit'); return }
  let N = 1
  while(N*2 <= buffer.length) N*=2
  const re = new Array(N).fill(0)
  const im = new Array(N).fill(0)
  for(let i=0;i<N;i++){
    const w = 0.5*(1 - Math.cos(2*Math.PI*i/(N-1)))
    re[i] = buffer[buffer.length - N + i] * w
  }
  fft(re,im)
  const dt = dt_ms/1000
  const fs = 1/dt
  const half = N/2
  const mags = new Array(half)
  const freqs = new Array(half)
  for(let i=0;i<half;i++){
    mags[i] = Math.sqrt(re[i]*re[i] + im[i]*im[i]) / N
    freqs[i] = i * fs / N
  }
  sctx.clearRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#071021'
  sctx.fillRect(0,0,specC.width,specC.height)
  sctx.strokeStyle = '#234'
  sctx.lineWidth = 1
  sctx.beginPath()
  sctx.moveTo(40,10)
  sctx.lineTo(40,specC.height-30)
  sctx.lineTo(specC.width-10,specC.height-30)
  sctx.stroke()
  const maxMag = Math.max(...mags)
  sctx.beginPath()
  for(let i=1;i<half;i++){
    const xpix = 40 + (specC.width-60) * (i/(half-1))
    const ypix = specC.height-30 - (specC.height-50) * (Math.log10(mags[i]+1e-12) - Math.log10(1e-12)) / (Math.log10(maxMag+1e-12)-Math.log10(1e-12))
    if(i===1) sctx.moveTo(xpix, ypix)
    else sctx.lineTo(xpix, ypix)
  }
  sctx.strokeStyle = '#ff7b72'
  sctx.lineWidth = 1
  sctx.stroke()
  let peakIdx = mags.indexOf(Math.max(...mags))
  sctx.fillStyle = '#9aa6b2'
  sctx.fillText('Peak freq: ' + freqs[peakIdx].toFixed(3) + ' Hz', 50, 20)
}

// Main loop
function loop(){
  const dt = dt_ms/1000
  step(dt)
  drawAnim()
  if(running) raf = requestAnimationFrame(loop)
}

// initial draw
drawAnim()
clearSpec()
