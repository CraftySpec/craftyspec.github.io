// Diatomic rotational spectrum simulator

function $(id) { return document.getElementById(id) }

// Physical constants
const u = 1.66053906660e-27
const h = 6.62607015e-34
const c_cm = 2.99792458e10
const kB = 1.380649e-23

// Parameters and state
let mass1 = parseFloat($('mass1').value)
let mass2 = parseFloat($('mass2').value)
let bondLength = parseFloat($('bondLength').value)
let vibFreq = parseFloat($('vibFreq').value)
let temperature = parseFloat($('temperature').value)
let maxJ = parseInt($('maxJ').value)
let userD = parseFloat($('userD').value)

// Canvas setup
const specC = $('specCanvas')
const sctx = specC.getContext('2d')

const levelsC = $('levelsCanvas')
const lctx = levelsC.getContext('2d')

// Spectrum data
let lines = []
let currentParams = null
let hoverIndex = -1

// View transform (zoom + pan)
let viewMin = null
let viewMax = null

// Peak selection
let selectedPeaks = []

// ------------------------------------------------------------
// Physics
// ------------------------------------------------------------

function calculateMolecularParameters() {
  const m1 = mass1 * u
  const m2 = mass2 * u
  const r = bondLength * 1e-10

  const mu = (m1 * m2) / (m1 + m2)
  const I = mu * r * r

  const B = h / (8 * Math.PI * Math.PI * c_cm * I)

  const D_calc = 4 * Math.pow(B, 3) / vibFreq
  const D_user = parseFloat($('userD').value)

  return {
    mu: mu,
    mu_u: mu / u,
    I: I,
    B: B,
    D_calc: D_calc,
    D_user: D_user
  }
}

function calculateSpectrum() {
  const p = calculateMolecularParameters()
  const result = []

  for (let J = 0; J < maxJ; J++) {
    const x = J * (J + 1)

    const E_lower = p.B * x - p.D_user * x * x

    const transition =
      2 * p.B * (J + 1) -
      4 * p.D_user * Math.pow(J + 1, 3)

    const population =
      (2 * J + 1) *
      Math.exp(-(h * c_cm * E_lower) / (kB * temperature))

    const intensity = (J + 1) * population

    result.push({
      J: J,
      E_lower: E_lower,
      wavenumber: transition,
      intensity: intensity
    })
  }

  const maxIntensity = Math.max(...result.map(line => line.intensity))
  for (const line of result) line.intensity /= maxIntensity

  return result
}

// ------------------------------------------------------------
// Formatting
// ------------------------------------------------------------

function formatSci(value, digits = 3) {
  return value.toExponential(digits)
}

function updateParameterLabels() {
  const p = currentParams

  $('muLabel').textContent = p.mu_u.toFixed(4) + ' u'
  $('iLabel').textContent = formatSci(p.I, 3) + ' kg m²'
  $('bLabel').textContent = p.B.toFixed(6) + ' cm⁻¹'
  $('dCalcLabel').textContent = p.D_calc.toExponential(3) + ' cm⁻¹'
  $('dUserLabel').textContent = p.D_user.toExponential(3) + ' cm⁻¹'

  if (lines.length > 0) {
    const peak = lines.reduce((a, b) => b.intensity > a.intensity ? b : a)
    $('jPeakLabel').textContent = peak.J + ' → ' + (peak.J + 1)
  }
}

// ------------------------------------------------------------
// Spectrum drawing
// ------------------------------------------------------------

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#071021'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawSpectrum() {
  clearCanvas(sctx, specC)

  const W = specC.width
  const H = specC.height

  const left = 65
  const right = 25
  const top = 30
  const bottom = 55
  const plotW = W - left - right
  const plotH = H - top - bottom

  const visible = lines.filter(line =>
    Number.isFinite(line.wavenumber) &&
    line.wavenumber > 0
  )

  if (visible.length === 0) {
    sctx.fillStyle = '#9aa6b2'
    sctx.fillText('No valid transitions', 20, 25)
    return
  }

  const range = { min: viewMin, max: viewMax }

  // Grid
  sctx.strokeStyle = '#24344d'
  sctx.lineWidth = 1

  for (let i = 0; i <= 6; i++) {
    const f = i / 6
    const x = left + f * plotW

    sctx.beginPath()
    sctx.moveTo(x, top)
    sctx.lineTo(x, top + plotH)
    sctx.stroke()

    const value = range.min + f * (range.max - range.min)

    sctx.fillStyle = '#9aa6b2'
    sctx.font = '12px sans-serif'
    sctx.textAlign = 'center'
    sctx.fillText(value.toFixed(1), x, H - 28)
  }

  // Axes
  sctx.strokeStyle = '#506078'
  sctx.beginPath()
  sctx.moveTo(left, top)
  sctx.lineTo(left, top + plotH)
  sctx.lineTo(left + plotW, top + plotH)
  sctx.stroke()

  // Lines
  for (let i = 0; i < visible.length; i++) {
    const line = visible[i]

    const f =
      (line.wavenumber - range.min) /
      (range.max - range.min)

    const x = left + f * plotW
    const y = top + plotH - line.intensity * plotH

    sctx.strokeStyle = i === hoverIndex ? '#ffffff' : '#4fd1c5'
    sctx.lineWidth = i === hoverIndex ? 3 : 2

    sctx.beginPath()
    sctx.moveTo(x, top + plotH)
    sctx.lineTo(x, y)
    sctx.stroke()

    if (i === hoverIndex) {
      sctx.fillStyle = '#ffffff'
      sctx.font = '13px sans-serif'
      sctx.textAlign = 'center'
      sctx.fillText(
        `J=${line.J} → ${line.J + 1}`,
        x,
        Math.max(18, y - 8)
      )
    }
  }

  // Selected peaks
  for (const peak of selectedPeaks) {
    const f = (peak.wavenumber - range.min) / (range.max - range.min)
    const x = left + f * plotW

    sctx.strokeStyle = '#ffdd55'
    sctx.lineWidth = 3
    sctx.beginPath()
    sctx.moveTo(x, top + plotH)
    sctx.lineTo(x, top)
    sctx.stroke()
  }

  // Axis labels
  sctx.fillStyle = '#9aa6b2'
  sctx.font = '13px sans-serif'
  sctx.textAlign = 'center'
  sctx.fillText('Wavenumber (cm⁻¹)', left + plotW / 2, H - 8)

  sctx.save()
  sctx.translate(17, top + plotH / 2)
  sctx.rotate(-Math.PI / 2)
  sctx.fillText('Relative intensity', 0, 0)
  sctx.restore()

  sctx.textAlign = 'left'
  sctx.fillStyle = '#9aa6b2'
  sctx.fillText(
    `T = ${temperature.toFixed(1)} K   |   B = ${currentParams.B.toFixed(4)} cm⁻¹`,
    left,
    18
  )
}

// ------------------------------------------------------------
// Energy-level drawing
// ------------------------------------------------------------

function drawEnergyLevels() {
  clearCanvas(lctx, levelsC)

  const W = levelsC.width
  const H = levelsC.height

  const left = 80
  const right = 40
  const top = 25
  const bottom = 45
  const plotH = H - top - bottom
  const plotW = W - left - right

  const levels = []

  for (let J = 0; J <= Math.min(maxJ, 20); J++) {
    const x = J * (J + 1)
    const E = currentParams.B * x - currentParams.D_user * x * x
    levels.push({ J: J, E: E })
  }

  const maxE = Math.max(...levels.map(level => level.E))

  for (const level of levels) {
    const y = top + plotH - (level.E / maxE) * plotH

    lctx.strokeStyle = '#4fd1c5'
    lctx.lineWidth = 2

    lctx.beginPath()
    lctx.moveTo(left, y)
    lctx.lineTo(left + plotW * 0.75, y)
    lctx.stroke()

    lctx.fillStyle = '#e8eef7'
    lctx.font = '12px sans-serif'
    lctx.textAlign = 'right'
    lctx.fillText(`J = ${level.J}`, left - 10, y + 4)
  }

  lctx.fillStyle = '#9aa6b2'
  lctx.font = '12px sans-serif'
  lctx.textAlign = 'left'
  lctx.fillText('Rotational energy / hc (cm⁻¹)', left, H - 12)
}

// ------------------------------------------------------------
// Table
// ------------------------------------------------------------

function updateTable() {
  const tbody = $('transitionTable')
  tbody.innerHTML = ''

  for (const line of lines) {
    const row = document.createElement('tr')

    row.innerHTML = `
      <td>J = ${line.J} → ${line.J + 1}</td>
      <td>${line.wavenumber.toFixed(6)}</td>
      <td>${line.intensity.toFixed(4)}</td>
    `

    tbody.appendChild(row)
  }
}

// ------------------------------------------------------------
// Peak difference
// ------------------------------------------------------------

function updatePeakDifference() {
  if (selectedPeaks.length < 2) {
    $('peakDiffLabel').textContent = 'Δν = —'
    return
  }

  const [p1, p2] = selectedPeaks
  const diff = Math.abs(p1.wavenumber - p2.wavenumber)

  $('peakDiffLabel').textContent =
    `Δν = ${diff.toFixed(5)} cm⁻¹`
}

// ------------------------------------------------------------
// Main calculation
// ------------------------------------------------------------

function updateSimulation() {
  mass1 = parseFloat($('mass1').value)
  mass2 = parseFloat($('mass2').value)
  bondLength = parseFloat($('bondLength').value)
  vibFreq = parseFloat($('vibFreq').value)
  temperature = parseFloat($('temperature').value)
  maxJ = parseInt($('maxJ').value)
  userD = parseFloat($('userD').value)

  currentParams = calculateMolecularParameters()
  lines = calculateSpectrum()

  const visible = lines.filter(l => l.wavenumber > 0)
  viewMin = visible[0].wavenumber
  viewMax = visible[visible.length - 1].wavenumber

  updateParameterLabels()
  drawSpectrum()
  drawMoleculeDiagram()
  updateTable()
}

// ------------------------------------------------------------
// Controls
// ------------------------------------------------------------

const inputIds = [
  'mass1',
  'mass2',
  'bondLength',
  'vibFreq',
  'temperature',
  'maxJ',
  'userD'
]

for (const id of inputIds) {
  $(id).addEventListener('input', updateSimulation)
}

$('reset').addEventListener('click', () => {
  $('mass1').value = '12.011'
  $('mass2').value = '15.999'
  $('bondLength').value = '1.128'
  $('vibFreq').value = '2170'
  $('temperature').value = '300'
  $('maxJ').value = '40'
  $('userD').value = '0.00002'

  updateSimulation()
})

// ------------------------------------------------------------
// Hover
// ------------------------------------------------------------

specC.addEventListener('mousemove', event => {
  if (!lines.length) return

  const rect = specC.getBoundingClientRect()
  const mouseX = (event.clientX - rect.left) *
    (specC.width / rect.width)

  const W = specC.width
  const left = 65
  const right = 25
  const plotW = W - left - right

  const visible = lines.filter(line => line.wavenumber > 0)

  let closest = -1
  let closestDistance = 12

  for (let i = 0; i < visible.length; i++) {
    const f =
      (visible[i].wavenumber - viewMin) /
      (viewMax - viewMin)

    const x = left + f * plotW
    const distance = Math.abs(mouseX - x)

    if (distance < closestDistance) {
      closestDistance = distance
      closest = i
    }
  }

  hoverIndex = closest

  if (hoverIndex >= 0) {
    const line = visible[hoverIndex]

    $('hoverLabel').textContent =
      `J=${line.J} → ${line.J + 1}   |   ` +
      `${line.wavenumber.toFixed(5)} cm⁻¹   |   ` +
      `relative intensity = ${line.intensity.toFixed(3)}`
  } else {
    $('hoverLabel').textContent = '—'
  }

  drawSpectrum()
})

specC.addEventListener('mouseleave', () => {
  hoverIndex = -1
  $('hoverLabel').textContent = '—'
  drawSpectrum()
})

// ------------------------------------------------------------
// Draw molecule
// ------------------------------------------------------------
function drawMoleculeDiagram() {
  clearCanvas(lctx, levelsC);

  const W = levelsC.width;
  const H = levelsC.height;

  // Extract parameters
  const m1 = mass1;
  const m2 = mass2;
  const r_angstrom = bondLength;

  // Convert bond length to pixels
  const bondPx = 250;  // fixed visual scale

  // Atom radii scaled by mass
  const minR = 20;
  const maxR = 60;

  function scaleRadius(m) {
    const mMin = 1;
    const mMax = 200;
    return minR + (maxR - minR) * ((m - mMin) / (mMax - mMin));
  }

  const r1 = scaleRadius(m1);
  const r2 = scaleRadius(m2);

  // Positions
  const cx = W / 2;
  const cy = H / 2;

  const x1 = cx - bondPx / 2;
  const x2 = cx + bondPx / 2;

  // Draw bond
  lctx.strokeStyle = "#cccccc";
  lctx.lineWidth = 6;
  lctx.beginPath();
  lctx.moveTo(x1, cy);
  lctx.lineTo(x2, cy);
  lctx.stroke();

  // Draw atoms
  function drawAtom(x, y, radius, label) {
    lctx.fillStyle = "#4fd1c5";
    lctx.beginPath();
    lctx.arc(x, y, radius, 0, Math.PI * 2);
    lctx.fill();

    lctx.fillStyle = "#ffffff";
    lctx.font = "16px sans-serif";
    lctx.textAlign = "center";
    lctx.fillText(label, x, y + 5);
  }

  drawAtom(x1, cy, r1, `m₁ = ${m1.toFixed(3)} u`);
  drawAtom(x2, cy, r2, `m₂ = ${m2.toFixed(3)} u`);

  // Bond length label
  lctx.fillStyle = "#ffffff";
  lctx.font = "16px sans-serif";
  lctx.textAlign = "center";
  lctx.fillText(`Bond length = ${r_angstrom.toFixed(3)} Å`, cx, cy - 80);
}


// ------------------------------------------------------------
// Zoom (mouse wheel)
// ------------------------------------------------------------

specC.addEventListener('wheel', event => {
  event.preventDefault()

  const zoomFactor = 0.1
  const mouseX = event.offsetX

  const W = specC.width
  const left = 65
  const right = 25
  const plotW = W - left - right

  const frac = (mouseX - left) / plotW
  const center = viewMin + frac * (viewMax - viewMin)

  const span = viewMax - viewMin
  const delta = span * zoomFactor * (event.deltaY > 0 ? 1 : -1)

  viewMin = center - (span - delta) * frac
  viewMax = center + (span - delta) * (1 - frac)

  drawSpectrum()
})

// ------------------------------------------------------------
// Pan (mouse drag)
// ------------------------------------------------------------

let isPanning = false
let lastX = 0

specC.addEventListener('mousedown', event => {
  isPanning = true
  lastX = event.clientX
})

specC.addEventListener('mousemove', event => {
  if (!isPanning) return

  const dx = event.clientX - lastX
  lastX = event.clientX

  const W = specC.width
  const left = 65
  const right = 25
  const plotW = W - left - right

  const span = viewMax - viewMin
  const shift = dx / plotW * span

  viewMin -= shift
  viewMax -= shift

  drawSpectrum()
})

specC.addEventListener('mouseup', () => isPanning = false)
specC.addEventListener('mouseleave', () => isPanning = false)

// ------------------------------------------------------------
// Peak selection (click)
// ------------------------------------------------------------

specC.addEventListener('click', event => {
  const rect = specC.getBoundingClientRect()
  const mouseX = (event.clientX - rect.left) *
    (specC.width / rect.width)

  const W = specC.width
  const left = 65
  const right = 25
  const plotW = W - left - right

  const visible = lines.filter(l => l.wavenumber > 0)

  let closest = null
  let closestDist = 12

  for (const line of visible) {
    const f = (line.wavenumber - viewMin) / (viewMax - viewMin)
    const x = left + f * plotW
    const d = Math.abs(mouseX - x)
    if (d < closestDist) {
      closestDist = d
      closest = line
    }
  }

  if (!closest) return

  selectedPeaks.push(closest)
  if (selectedPeaks.length > 2) selectedPeaks.shift()

  updatePeakDifference()
  drawSpectrum()
})

// ------------------------------------------------------------
// Initial calculation
// ------------------------------------------------------------

updateSimulation()

