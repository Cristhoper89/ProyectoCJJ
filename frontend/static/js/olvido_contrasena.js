// ======================================================
// OLVIDO DE CONTRASEÑA
// ======================================================

const API_URL = "http://127.0.0.1:8000";

// ======================================================
// ELEMENTOS
// ======================================================

const recoveryForm = document.getElementById("recoveryForm");
const stepEmail = document.getElementById("stepEmail");
const stepReset = document.getElementById("stepReset");
const email = document.getElementById("email");
const codigo = document.getElementById("codigo");
const nuevaContrasena = document.getElementById("nuevaContrasena");
const confirmarContrasena = document.getElementById("confirmarContrasena");
const formMessage = document.getElementById("formMessage");

let correoGuardado = "";
let enPaso2 = false;

// ======================================================
// MOSTRAR / OCULTAR CONTRASEÑA
// ======================================================

document.querySelectorAll(".show-password").forEach((button) => {

    button.addEventListener("click", () => {

        const input = button.parentElement.querySelector("input");
        const icon = button.querySelector("i");

        if (input.type === "password") {

            input.type = "text";

            if (icon) {
                icon.setAttribute("data-lucide", "eye-off");
                lucide.createIcons();
            }

        } else {

            input.type = "password";

            if (icon) {
                icon.setAttribute("data-lucide", "eye");
                lucide.createIcons();
            }

        }

    });

});

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
// SOLICITAR CÓDIGO DE RECUPERACIÓN
// ======================================================

async function enviarCodigoRecuperacion(correo) {

    showMessage(
        "Enviando código...",
        "warning"
    );

    try {

        const response = await fetch(`${API_URL}/auth/forgot-password`, {

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
            stepReset.hidden = false;

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
// RESTABLECER CONTRASEÑA
// ======================================================

async function restablecerContrasena() {

    showMessage(
        "Restableciendo contraseña...",
        "warning"
    );

    try {

        const response = await fetch(`${API_URL}/auth/reset-password`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                correo: correoGuardado,
                codigo: codigo.value.trim(),
                nuevaContrasena: nuevaContrasena.value.trim()
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

recoveryForm.addEventListener("submit", async (e) => {

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

        await enviarCodigoRecuperacion(correo);

        return;

    }

    const code = codigo.value.trim();
    const nueva = nuevaContrasena.value.trim();
    const confirmar = confirmarContrasena.value.trim();

    if (code === "") {

        showMessage(
            "Ingrese el código de verificación.",
            "error"
        );

        codigo.focus();

        return;

    }

    if (nueva === "") {

        showMessage(
            "Ingrese su nueva contraseña.",
            "error"
        );

        nuevaContrasena.focus();

        return;

    }

    if (nueva.length < 6) {

        showMessage(
            "La contraseña debe tener al menos 6 caracteres.",
            "error"
        );

        nuevaContrasena.focus();

        return;

    }

    if (nueva !== confirmar) {

        showMessage(
            "Las contraseñas no coinciden.",
            "error"
        );

        confirmarContrasena.focus();

        return;

    }

    await restablecerContrasena();

});
