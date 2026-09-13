const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");

function sendMessage() {
    const text = input.value.trim();

    if (text === "") {
        return;
    }

    const message = document.createElement("div");
    message.className = "message mine";

    message.innerHTML = `
        <div class="bubble">
            ${escapeHTML(text)}
        </div>
    `;

    messages.appendChild(message);

    input.value = "";

    messages.scrollTop = messages.scrollHeight;
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

sendButton.addEventListener("click", sendMessage);

input.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});
