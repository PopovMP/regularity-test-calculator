'use strict'

let inputTextArea
let outputTableBody
let errorMessage
let buttonCalculate
let isError = false

function initialize() {
	inputTextArea   = document.getElementById('input')
	outputTableBody = document.getElementById('output')
	errorMessage    = document.getElementById('error-message')
	buttonCalculate = document.getElementById('button-calculate')

	inputTextArea.addEventListener('change', inputText_changed)
	buttonCalculate.addEventListener('click', buttonCalculate_click)
}

const tags = {
	start  : 'RT Start',
	end    : 'RT End',
	wp     : 'WP',
	error  : 'Error',
	ignore : 'Ignore this line',
}

/** @typedef RTData
 *
 * @property { number } distKm
 * @property { number } deltaKm
 * @property { number } distMls
 * @property { number } speedKmh
 * @property { number } time
 */

/** @typedef CodeRecord
 *
 * @property { number } line
 * @property { string } tag
 * @property { number } distKm
 * @property { number } speedKmh
 */

function parseInput() {
	isError = false

	/** @type { CodeRecord[] } */
	const records = inputTextArea.value
		.split(/\n/)
		.filter(line => line?.length > 0)
		.map(line => line.trim())
		.map((line, index) => {
			if (line === '') {
				return {
					line     : index,
					tag      : tags.ignore,
					distKm   : NaN,
					speedKmh : NaN,
				}
			}

			if (line === '...') {
				return {
					line     : index,
					tag      : tags.start,
					distKm   : NaN,
					speedKmh : NaN,
				}
			}

			if (line === '===') {
				return {
					line     : index,
					tag      : tags.end,
					distKm   : NaN,
					speedKmh : NaN,
				}
			}

			const data = line.split(/[, \t]+/)

			// Parse distance
			if (data.length === 1) {
				const distKm = parseFloat(data[0])
				if (isNaN(distKm)) {
					updateError(`Error line ${index + 1}. Cannot parse distance: ${data[0]}`)
					isError = true
				}

				return {
					line     : index,
					tag      : tags.wp,
					distKm   : distKm,
					speedKmh : NaN,
				}
			}

			// Parse distance and speed
			if (data.length === 2) {
				const distKm = parseFloat(data[0])
				if (isNaN(distKm)) {
					updateError(`Error line ${index + 1}. Cannot parse distance: ${data[0]}`)
					isError = true

				}

				const speedKmh = parseFloat(data[1])
				if (isNaN(speedKmh)) {
					updateError(`Error line ${index + 1}. Cannot parse speed: ${data[1]}`)
					isError = true

				}

				return {
					line     : index,
					tag      : tags.wp,
					distKm   : distKm,
					speedKmh : speedKmh,
				}
			}


			updateError(`Error line ${index + 1}. Cannot parse text: ${line}`)
			isError = true

			return {
				tag      : tags.error,
				distKm   : NaN,
				speedKmh : NaN,
			}
		})

	if (!isError) {
		errorMessage.style.display = 'none'
	}

	calculateData(records)
}

/**
 *
 * @param { CodeRecord[] } records
 */
function calculateData(records) {

	/** @type { RTData[] } */
	const data = []
	let prevDistKm   = 0
	let prevSpeed    = 0
	let totalSeconds = 0
	let isRT = false
	let isStart = false

	for(let i = 0; i < records.length; i++) {
		const rec = records[i]

		if (rec.tag === tags.ignore || rec.tag === tags.error) {
			continue
		}

		if (rec.tag === tags.start) {
			if (isRT) {
				updateError(`Error line ${rec.line + 1}. RT section already started`)
				isError = true
			}
			isStart = true
			isRT = true
			totalSeconds = 0
			continue
		}

		if (rec.tag === tags.end) {
			if (!isRT) {
				updateError(`Error line ${rec.line + 1}. RT section is not started`)
				isError = true
			}
			isRT = false
			totalSeconds = 0
			continue
		}

		if (rec.tag === tags.wp && !isRT) {
			data.push( {
				distKm  : rec.distKm,
				deltaKm : rec.distKm - prevDistKm,
				distMls : rec.distKm / 1.609,
				speedKmh: 0,
				time    : 0,
			})
			prevDistKm = rec.distKm
			totalSeconds = 0
			continue
		}

		if (isRT && isNaN(rec.speedKmh)) {
			rec.speedKmh = prevSpeed
		}

		if (isStart) {
			prevSpeed  = rec.speedKmh
		}

		const deltaKm  = rec.distKm - prevDistKm
		prevDistKm    = rec.distKm
		totalSeconds += isStart ? 0 : 3600 * (deltaKm / prevSpeed)
		prevSpeed     = rec.speedKmh

		data.push( {
			distKm  : rec.distKm,
			deltaKm : deltaKm,
			distMls : rec.distKm / 1.609,
			speedKmh: rec.speedKmh,
			time    : isStart ? 0 : totalSeconds,
		})

		isStart = false
	}

	updateTable(data)

	if (!isError) {
		updateError()
	}
}


function secondsToTimeString(value) {
	const secs    = value % 60
	const val2    = (value - secs) / 60
	const min     = val2 % 60
	const hrs     = (val2 - min) / 60
	const hrsText = hrs  < 10 ? '0' + hrs  : hrs.toString()
	const minText = min  < 10 ? '0' + min  : min.toString()
	const secText = secs < 10 ? '0' + secs : secs.toString()

	return hrs === 0
		? minText + ':' + secText
		: hrsText + ':' + minText + ':' + secText
}

/**
 * @param { RTData[] } data
 */
function updateTable(data) {
	outputTableBody.innerHTML = data.map(rec => `
		<tr>
            <td>${ rec.distKm.toFixed(2)   }</td>
            <td>${ rec.deltaKm.toFixed(2)  }</td>
            <td>${ rec.distMls.toFixed(2)  }</td>
            <td>${ rec.speedKmh > 0 ? rec.speedKmh.toString() : '' }</td>
            <td>${ rec.time > 0 ? secondsToTimeString( Math.round(rec.time)) : '' }</td>
        </tr>`
	).join('\n')
}

/**
 * @param { string } [message]
 */
function updateError(message) {
	if (message) {
		errorMessage.style.display = 'block'
		errorMessage.innerText = message
	}
	else {
		errorMessage.style.display = 'none'
		errorMessage.innerText = ''
	}
}

function inputText_changed(event) {
	event.preventDefault()
	parseInput()
}

function buttonCalculate_click(event) {
	event.preventDefault()
	parseInput()
}
