let searchHighlights = []; // array of {x, y, width, height} for current page
const HIGHLIGHT_COLOR = 'rgba(255, 255, 0, 0.4)'; // yellow semi-transparent

// script.js – must be loaded as type="module"

import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs';

// Set the worker source (required for rendering)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

let pdfDoc = null;
let pageNum = 1;
let pageCount = 0;
let scale = 1.5;
let canvas = null;
let ctx = null;

const pdfContainer = document.getElementById('pdf-container');
const pageNumDisplay = document.getElementById('page-num');
const pageCountDisplay = document.getElementById('page-count');

// Render the current page
async function renderPage(num) {
    if (!pdfDoc) return;

    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });

        // Create canvas only once
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d');
            pdfContainer.appendChild(canvas);
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Draw search highlights on top
if (searchHighlights.length > 0) {
    ctx.save();
    ctx.fillStyle = HIGHLIGHT_COLOR;
    searchHighlights.forEach(h => {
        ctx.fillRect(h.x, h.y, h.width, h.height);
    });
    ctx.restore();
}

        pageNumDisplay.textContent = num;
        pdfContainer.scrollTop = 0;   // scroll container to top after render/zoom
    } catch (err) {
        console.error('Render error:', err);
        alert('Error rendering page: ' + err.message);
    }
}

// Load PDF when file is selected
document.getElementById('pdf-upload').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDoc = await loadingTask.promise;

        pageCount = pdfDoc.numPages;
        await generateThumbnails();
        await renderPage(pageNum);
        pageCountDisplay.textContent = pageCount;
        pageNum = 1;

        pdfContainer.innerHTML = ''; // Clear previous canvas
        canvas = null; // Force recreate

        await renderPage(pageNum);
    } catch (err) {
        console.error('PDF load error:', err);
        alert('Failed to load PDF: ' + err.message);
    }
});

// Navigation buttons
document.getElementById('prev-page').addEventListener('click', async () => {
    if (pageNum <= 1) return;
    pageNum--;
    await renderPage(pageNum);
});

document.getElementById('next-page').addEventListener('click', async () => {
    if (pageNum >= pageCount) return;
    pageNum++;
    await renderPage(pageNum);
});

// Zoom buttons
document.getElementById('zoom-in').addEventListener('click', async () => {
    scale += 0.2;
    await renderPage(pageNum);
});

document.getElementById('zoom-out').addEventListener('click', async () => {
    if (scale <= 0.5) return;
    scale -= 0.2;
    await renderPage(pageNum);
});

// Simple text search + visual highlight
document.getElementById('search-btn').addEventListener('click', async () => {
    if (!pdfDoc) return;

    const searchText = document.getElementById('search-text').value.trim().toLowerCase();
    if (!searchText) {
        alert('Enter text to search.');
        return;
    }

    // Clear previous highlights
    searchHighlights = [];

    try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Get viewport to convert PDF coords → canvas coords
        const viewport = page.getViewport({ scale });

        // Loop through text items and find matches
        textContent.items.forEach(item => {
            const str = item.str.toLowerCase();
            if (str.includes(searchText)) {
                // item.transform = [scaleX, skewY, skewX, scaleY, x, y] in PDF units (bottom-left origin)
                // Convert to canvas coords (top-left origin)
                const tx = item.transform[4];
                const ty = item.transform[5];
                const width = item.width;
                const height = item.height;

                // Transform PDF point to viewport coords
                const pdfPoint = viewport.convertToViewportPoint(tx, ty);
                const pdfSize = viewport.convertToViewportPoint(tx + width, ty + height);

                const highlight = {
                    x: pdfPoint[0],
                    y: pdfPoint[1] - height, // flip y (PDF bottom-up → canvas top-down)
                    width: pdfSize[0] - pdfPoint[0],
                    height: height
                };

                searchHighlights.push(highlight);
            }
        });

        // Re-render page to show highlights
        await renderPage(pageNum);

        if (searchHighlights.length === 0) {
            alert(`"${searchText}" not found on this page.`);
        } else {
            console.log(`Found ${searchHighlights.length} matches`);
            // Optional: alert(`Found ${searchHighlights.length} match(es)!`);
        }
    } catch (err) {
        alert('Search error: ' + err.message);
    }
});

// Notes – saved in browser localStorage
document.getElementById('save-notes').addEventListener('click', () => {
    const notes = document.getElementById('notes').value;
    localStorage.setItem('pdfReaderNotes', notes);
    alert('Notes saved!');
});

// Clear highlights
document.getElementById('clear-highlights').addEventListener('click', async () => {
    searchHighlights = [];
    await renderPage(pageNum);
});

// Adding thumbnails
let thumbnails = [];
const thumbnailsContainer = document.getElementById('thumbnails');

async function generateThumbnails() {
    thumbnailsContainer.innerHTML = ''; // clear
    thumbnails = [];

    const thumbScale = 0.3; // small size

    for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: thumbScale });

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = viewport.width;
        thumbCanvas.height = viewport.height;
        const thumbCtx = thumbCanvas.getContext('2d');

        await page.render({
            canvasContext: thumbCtx,
            viewport: viewport
        }).promise;

        thumbCanvas.className = 'thumbnail';
        thumbCanvas.dataset.page = i;
        if (i === pageNum) thumbCanvas.classList.add('active');

        thumbCanvas.addEventListener('click', async () => {
            pageNum = parseInt(thumbCanvas.dataset.page);
            await renderPage(pageNum);

            // Update active class
            document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
            thumbCanvas.classList.add('active');
        });

        thumbnailsContainer.appendChild(thumbCanvas);
        thumbnails.push(thumbCanvas);
    }
}

// Load saved notes on start
document.getElementById('notes').value = localStorage.getItem('pdfReaderNotes') || '';

// Optional: Clear notes button (add if you want)
// <button id="clear-notes">Clear Notes</button>
// Then:
// document.getElementById('clear-notes').addEventListener('click', () => {
//     localStorage.removeItem('pdfReaderNotes');
//     document.getElementById('notes').value = '';
//     alert('Notes cleared.');
// });