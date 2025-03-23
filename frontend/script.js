// DOM Elements
const rideForm = document.getElementById('rideForm');
const rideList = document.getElementById('rideList');
const contactPopup = document.getElementById('contactPopup');
const contactDetails = document.getElementById('contactDetails');
const closePopup = document.getElementById('closePopup');
const darkModeToggle = document.getElementById('darkMode');

// Load rides from localStorage
let rides = JSON.parse(localStorage.getItem('rides')) || [];


// Function to display rides
function displayRides() {
    rideList.innerHTML = ''; // Clear the list
    rides.forEach((ride, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>From:</strong> ${ride.from}<br>
            <strong>To:</strong> ${ride.destination}<br>
            <strong>Date:</strong> ${ride.date}<br>
            <strong>Time:</strong> ${ride.time}<br>
            <strong>Seats:</strong> ${ride.seats}<br>
            <strong>Cost:</strong> ₹${ride.cost}/person<br>
            ${window.location.pathname.includes('post.html') ? `<button onclick="deleteRide(${index})">Delete</button>` : `<button onclick="showContact('${ride.contact}')">Interested</button>`}
        `;
        rideList.appendChild(li);
    });
}

// Function to add a ride
if (rideForm) {
    rideForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const from = document.getElementById('from').value;
        const destination = document.getElementById('destination').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const seats = document.getElementById('seats').value;
        const cost = document.getElementById('cost').value;
        const contact = document.getElementById('contact').value;

        const newRide = { from, destination, date, time, seats, cost, contact };
        rides.push(newRide);
        localStorage.setItem('rides', JSON.stringify(rides));

        displayRides();
        rideForm.reset(); // Clear the form
    });
}

// Function to delete a ride
function deleteRide(index) {
    rides.splice(index, 1); // Remove the ride from the array
    localStorage.setItem('rides', JSON.stringify(rides));
    displayRides();
}

// Function to show contact details in a popup
function showContact(contact) {
    contactDetails.textContent = contact;
    contactPopup.style.display = 'flex';
}

// Close the popup
closePopup.addEventListener('click', () => {
    contactPopup.style.display = 'none';
});

// Dark Mode Toggle
document.addEventListener("DOMContentLoaded", () => {
    const darkModeToggle = document.getElementById("darkMode");

    if (darkModeToggle) {
        // Load saved dark mode preference
        const savedDarkMode = localStorage.getItem("darkMode") === "true";
        darkModeToggle.checked = savedDarkMode;
        document.body.classList.toggle("dark-mode", savedDarkMode);

        // Add event listener
        darkModeToggle.addEventListener("change", () => {
            document.body.classList.toggle("dark-mode", darkModeToggle.checked);
            localStorage.setItem("darkMode", darkModeToggle.checked);
        });
    }
});


// Display rides on page load
displayRides();

//Profile Data
document.addEventListener("DOMContentLoaded", function () {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "auth.html";
    } else {
        document.getElementById("profileName").innerText = user.name;
        document.getElementById("profileEmail").innerText = user.email;
    }

    document.getElementById("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem("user");
        window.location.href = "auth.html";
    });
});
