// ======================================================
// DESBLOQUEO DE CUENTA
// ======================================================

const API_URL = "http://127.0.0.1:8000";

// ======================================================
// ELEMENTOS
// ======================================================

const unlockForm = document.getElementById("unlockForm");
const stepEmail = document.getElementById("stepEmail");
const stepCode = document.getElementById("stepCode");
const email = document.getElementById("email");
const codigo = document.getElementById("codigo");
const formMessage = document.getElementById("formMessage");

let correoGuardado = "";
let enPaso2 = false;

// ======================================================
// MENSAJES
// ======================================================

function clearMessage() {

    formMessage.className = "login-message";
    formMessage.textContent = "";

}

function showMessage(text, type) {

    formMessage.className = `login-message ${type}`;
    formMessage.textContent = text;

}

// ======================================================
// ENVIAR CÓDIGO DE DESBLOQUEO
// ======================================================

async function enviarCodigoDesbloqueo(correo) {

    showMessage(
        "Enviando código...",
        "warning"
    );

    try {

        const response = await fetch(`${API_URL}/auth/send-unlock-code`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ correo })

        });

        const data = await response.json();

        if (response.ok) {

            correoGuardado = correo;

            showMessage(
                data.mensaje,
                "success"
            );

            stepEmail.hidden = true;
            stepCode.hidden = false;

            enPaso2 = true;

            codigo.focus();

            return;

        }

        showMessage(
            data.detail,
            "error"
        );

    }

    catch (error) {

        console.error(error);

        showMessage(
            "No fue posible conectar con el servidor.",
            "error"
        );

    }

}

// ======================================================
// DESBLOQUEAR LA CUENTA
// ======================================================

async function desbloquearCuenta() {

    showMessage(
        "Desbloqueando cuenta...",
        "warning"
    );

    try {

        const response = await fetch(`${API_URL}/auth/unlock-account`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                correo: correoGuardado,
                codigo: codigo.value.trim()
            })

        });

        const data = await response.json();

        if (response.ok) {

            showMessage(
                data.mensaje,
                "success"
            );

            setTimeout(() => {

                window.location.href = "login.html";

            }, 2000);

            return;

        }

        showMessage(
            data.detail,
            "error"
        );

    }

    catch (error) {

        console.error(error);

        showMessage(
            "No fue posible conectar con el servidor.",
            "error"
        );

    }

}

// ======================================================
// ENVÍO DEL FORMULARIO
// ======================================================

unlockForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    clearMessage();

    if (!enPaso2) {

        const correo = email.value.trim();

        if (correo === "") {

            showMessage(
                "Ingrese su correo electrónico.",
                "error"
            );

            email.focus();

            return;

        }

        await enviarCodigoDesbloqueo(correo);

        return;

    }

    const code = codigo.value.trim();

    if (code === "") {

        showMessage(
            "Ingrese el código de desbloqueo.",
            "error"
        );

        codigo.focus();

        return;

    }

    await desbloquearCuenta();

});
