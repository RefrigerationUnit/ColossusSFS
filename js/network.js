const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let w, h;
const starCount = 400; // Adjust number of stars here

function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    drawStars();
}

function drawStars() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "white";
    
    for (let i = 0; i < starCount; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        // Random size between 0.5px and 2px
        const size = Math.random() * 1.5 + 0.5;
        // Random opacity for depth
        const opacity = Math.random();
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

window.addEventListener("resize", resize);

// Initial draw
resize();