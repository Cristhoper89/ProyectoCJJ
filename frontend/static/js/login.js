// ======================================================
// LOGIN
// ======================================================

const API_URL = "http://127.0.0.1:8000";

// ======================================================
// ELEMENTOS
// ======================================================

const loginForm = document.getElementById("loginForm");
const username = document.getElementById("username");
const password = document.getElementById("password");
const loginMessage = document.getElementById("loginMessage");
const showPassword = document.querySelector(".show-password");

// ======================================================
// MOSTRAR / OCULTAR CONTRASEÑA
// ======================================================

showPassword.addEventListener("click", () => {

    const icon = showPassword.querySelector("i");

    if (password.type === "password") {

        password.type = "text";

        if(icon){
            icon.setAttribute("data-lucide","eye-off");
            lucide.createIcons();
        }

    } else {

        password.type = "password";

        if(icon){
            icon.setAttribute("data-lucide","eye");
            lucide.createIcons();
        }

    }

});

// ======================================================
// MENSAJES
// ======================================================

function clearMessage(){

    loginMessage.className = "login-message";
    loginMessage.textContent = "";

}

function showMessage(text,type){

    loginMessage.className = `login-message ${type}`;
    loginMessage.textContent = text;

}

// ======================================================
// LOGIN
// ======================================================

loginForm.addEventListener("submit", async (e)=>{

    e.preventDefault();

    clearMessage();

    const user = username.value.trim();
    const pass = password.value.trim();

    if(user === ""){

        showMessage(
            "Ingrese su usuario.",
            "error"
        );

        username.focus();

        return;

    }

    if(pass === ""){

        showMessage(
            "Ingrese su contraseña.",
            "error"
        );

        password.focus();

        return;

    }

    showMessage(
        "Validando credenciales...",
        "warning"
    );

    const formData = new URLSearchParams();

    formData.append("username",user);
    formData.append("password",pass);

    try{

        const response = await fetch(`${API_URL}/auth/login`,{

            method:"POST",

            headers:{
                "Content-Type":"application/x-www-form-urlencoded"
            },

            body:formData

        });

        const data = await response.json();

        // ==========================================
        // LOGIN CORRECTO
        // ==========================================

        if(response.ok){

            localStorage.setItem(
                "access_token",
                data.access_token
            );

            localStorage.setItem(
                "token_type",
                data.token_type
            );

            showMessage(
                "Bienvenido al sistema.",
                "success"
            );

            setTimeout(()=>{

                window.location.href="../templates/dashboard.html";

            },1000);

            return;

        }

        // ==========================================
        // CUENTA BLOQUEADA
        // ==========================================

        if(response.status===403){

            showMessage(
                data.detail,
                "warning"
            );

            return;

        }

        // ==========================================
        // DEMÁS ERRORES
        // ==========================================

        showMessage(
            data.detail,
            "error"
        );

    }

    catch(error){

        console.error(error);

        showMessage(
            "No fue posible conectar con el servidor.",
            "error"
        );

    }

});