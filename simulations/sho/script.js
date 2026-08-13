// Simple Harmonic Oscillator demo
// Place in same folder as index.html

// Utilities
function $(id){return document.getElementById(id)}

// Parameters and state
let mass = parseFloat($('mass').value)
let k = parseFloat($('k').value)
let amp = parseFloat($('amp').value)
let gamma = parseFloat($('gamma').value)
let dt_ms = parseFloat($('dt').value)

let t = 0
let x = amp
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

// Physics integrator: velocity Verlet for stability
function step(dt){
  const a = (-k*x - gamma*v)/mass
  v += a*dt
  x += v*dt
  t += dt
  // store sample
  buffer.push(x)
  if(buffer.length > MAX_SAMPLES) buffer.shift()
}

// Animation and drawing
function drawAnim(){
  const W = animC.width, H = animC.height
  actx.clearRect(0,0,W,H)
  // draw baseline
  actx.strokeStyle = '#234'
  actx.lineWidth = 2
  actx.beginPath()
  actx.moveTo(10,H/2)
  actx.lineTo(W-10,H/2)
  actx.stroke()

  // draw spring as line from left to mass
  const cx = 80 + (W-160) * (0.5 + x/2) // map x to canvas
  // spring
  actx.strokeStyle = '#4fd1c5'
  actx.lineWidth = 3
  actx.beginPath()
  actx.moveTo(20,H/2)
  actx.lineTo(cx-20,H/2)
  actx.stroke()
  // mass block
  actx.fillStyle = '#4fd1c5'
  actx.fillRect(cx-20,H/2-20,40,40)

  // labels
  $('timeLabel').textContent = t.toFixed(2)
  $('posLabel').textContent = x.toFixed(3)
}

// Spectrum drawing helpers
function clearSpec(){
  sctx.clearRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#071021'
  sctx.fillRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#9aa6b2'
  sctx.fillText('Spectrum will appear here after computing', 10, 20)
}

// Simple FFT using Cooley-Tukey (radix-2). For clarity and small sizes only.
function fft(re, im){
  const n = re.length
  if(n <= 1) return
  const levels = Math.log2(n)
  if(Math.floor(levels) !== levels) throw 'FFT size must be power of 2'
  // bit-reverse
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

// Compute spectrum and draw
function computeAndDrawSpectrum(){
  if(buffer.length < 64){ alert('Collect more samples by running the simulation for a bit'); return }
  // choose power-of-two length
  let N = 1
  while(N*2 <= buffer.length) N*=2
  const re = new Array(N).fill(0)
  const im = new Array(N).fill(0)
  // windowing (Hann)
  for(let i=0;i<N;i++){
    const w = 0.5*(1 - Math.cos(2*Math.PI*i/(N-1)))
    re[i] = buffer[buffer.length - N + i] * w
  }
  fft(re,im)
  // compute magnitudes and frequencies
  const dt = dt_ms/1000
  const fs = 1/dt
  const half = N/2
  const mags = new Array(half)
  const freqs = new Array(half)
  for(let i=0;i<half;i++){
    mags[i] = Math.sqrt(re[i]*re[i] + im[i]*im[i]) / N
    freqs[i] = i * fs / N
  }
  // draw
  sctx.clearRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#071021'
  sctx.fillRect(0,0,specC.width,specC.height)
  // axes
  sctx.strokeStyle = '#234'
  sctx.lineWidth = 1
  sctx.beginPath()
  sctx.moveTo(40,10)
  sctx.lineTo(40,specC.height-30)
  sctx.lineTo(specC.width-10,specC.height-30)
  sctx.stroke()
  // plot magnitude (log scale)
  const maxMag = Math.max(...mags)
  for(let i=1;i<half;i++){
    const xpix = 40 + (specC.width-60) * (i/(half-1))
    const ypix = specC.height-30 - (specC.height-50) * (Math.log10(mags[i]+1e-12) - Math.log10(1e-12)) / (Math.log10(maxMag+1e-12)-Math.log10(1e-12))
    if(i===1) sctx.beginPath()
    sctx.strokeStyle = '#ff7b72'
    sctx.lineWidth = 1
    sctx.lineTo(xpix, ypix)
  }
  sctx.stroke()
  // label peak frequency
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
