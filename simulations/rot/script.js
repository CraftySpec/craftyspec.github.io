// Diatomic rotational spectrum simulator
// Based on the same simple DOM/canvas style as the harmonic oscillator demo.

function $(id) { return document.getElementById(id) }

// Physical constants
const u = 1.66053906660e-27       // atomic mass unit, kg
const h = 6.62607015e-34          // Planck constant, J s
const c_cm = 2.99792458e10        // speed of light, cm s^-1
const kB = 1.380649e-23           // Boltzmann constant, J K^-1

// Parameters and state
let mass1 = parseFloat($('mass1').value)
let mass2 = parseFloat($('mass2').value)
let bondLength = parseFloat($('bondLength').value)
let vibFreq = parseFloat($('vibFreq').value)
let temperature = parseFloat($('temperature').value)
let maxJ = parseInt($('maxJ').value)

// Canvas setup
const specC = $('specCanvas')
const sctx = specC.getContext('2d')

const levelsC = $('levelsCanvas')
const lctx = levelsC.getContext('2d')

// Spectrum data
let lines = []
let currentParams = null
let hoverIndex = -1

// ------------------------------------------------------------
// Physics
// ------------------------------------------------------------

function calculateMolecularParameters() {
  const m1 = mass1 * u
  const m2 = mass2 * u
  const r = bondLength * 1e-10

  // Reduced mass
  const mu = (m1 * m2) / (m1 + m2)

  // Moment of inertia about the centre of mass
  const I = mu * r * r

  // Rotational constant in cm^-1
  const B = h / (8 * Math.PI * Math.PI * c_cm * I)

  // Approximate centrifugal distortion constant:
  // D = 4 B^3 / omega_e
  // B and omega_e are both expressed in cm^-1.
  const D = 4 * Math.pow(B, 3) / vibFreq

  return {
    mu: mu,
    mu_u: mu / u,
    I: I,
    B: B,
    D: D
  }
}

function calculateSpectrum() {
  const p = calculateMolecularParameters()
  const result = []

  for (let J = 0; J < maxJ; J++) {
    const x = J * (J + 1)

    // Rotational energy of lower state, in cm^-1
    const E_lower = p.B * x - p.D * x * x

    // J -> J+1 transition, in cm^-1
    const transition =
      2 * p.B * (J + 1) -
      4 * p.D * Math.pow(J + 1, 3)

    // Lower-state Boltzmann population.
    // E_lower is in cm^-1, so convert hc*E to joules.
    const population =
      (2 * J + 1) *
      Math.exp(-(h * c_cm * E_lower) / (kB * temperature))

    // Hönl-London factor for a simple Sigma -> Sigma
    // rotational transition: proportional to J+1.
    const intensity = (J + 1) * population

    result.push({
      J: J,
      E_lower: E_lower,
      wavenumber: transition,
      intensity: intensity
    })
  }

  const maxIntensity = Math.max(...result.map(line => line.intensity))

  for (const line of result) {
    line.intensity /= maxIntensity
  }

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

  $('muLabel').textContent =
    p.mu_u.toFixed(4) + ' u'

  $('iLabel').textContent =
    formatSci(p.I, 3) + ' kg m²'

  $('bLabel').textContent =
    p.B.toFixed(6) + ' cm⁻¹'

  $('dLabel').textContent =
    formatSci(p.D, 3) + ' cm⁻¹'

  if (lines.length > 0) {
    const peak = lines.reduce((a, b) =>
      b.intensity > a.intensity ? b : a
    )

    $('jPeakLabel').textContent =
      peak.J + ' → ' + (peak.J + 1)
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

function niceRange(min, max) {
  const pad = (max - min) * 0.04
  return {
    min: Math.max(0, min - pad),
    max: max + pad
  }
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

  const range = niceRange(
    visible[0].wavenumber,
    visible[visible.length - 1].wavenumber
  )

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

    // Transition label for selected line
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
    const E = currentParams.B * x - currentParams.D * x * x

    levels.push({ J: J, E: E })
  }

  const maxE = Math.max(...levels.map(level => level.E))

  sctx.textAlign = 'left'

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

  // Energy axis
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
// Main calculation
// ------------------------------------------------------------

function updateSimulation() {
  mass1 = parseFloat($('mass1').value)
  mass2 = parseFloat($('mass2').value)
  bondLength = parseFloat($('bondLength').value)
  vibFreq = parseFloat($('vibFreq').value)
  temperature = parseFloat($('temperature').value)
  maxJ = parseInt($('maxJ').value)

  if (
    !Number.isFinite(mass1) || mass1 <= 0 ||
    !Number.isFinite(mass2) || mass2 <= 0 ||
    !Number.isFinite(bondLength) || bondLength <= 0 ||
    !Number.isFinite(vibFreq) || vibFreq <= 0 ||
    !Number.isFinite(temperature) || temperature <= 0
  ) {
    return
  }

  currentParams = calculateMolecularParameters()
  lines = calculateSpectrum()

  updateParameterLabels()
  drawSpectrum()
  drawEnergyLevels()
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
  'maxJ'
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

  updateSimulation()
})

// ------------------------------------------------------------
// Spectrum hover
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

  const range = niceRange(
    visible[0].wavenumber,
    visible[visible.length - 1].wavenumber
  )

  let closest = -1
  let closestDistance = 12

  for (let i = 0; i < visible.length; i++) {
    const f =
      (visible[i].wavenumber - range.min) /
      (range.max - range.min)

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

// Initial calculation
updateSimulation()
