// ======================================================
// LOGIN
// ======================================================

const API_URL = "https://serviciocontigo.io/api"; // web
//const API_URL = "http://xwho2nzoxgmaxbhkyqnfbiwu.2.24.87.5.sslip.io"; // local
const API_URL_STORAGE_KEY = "api_base_url";

if (localStorage.getItem(API_URL_STORAGE_KEY) !== API_URL) {
    localStorage.removeItem("access_token");
    localStorage.setItem(API_URL_STORAGE_KEY, API_URL);
}

// ======================================================
// ELEMENTOS
// ======================================================

const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");
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

    const userEmail = email.value.trim();
    const pass = password.value.trim();

    if(userEmail === ""){

        showMessage(
            "Ingrese su correo electrónico.",
            "error"
        );

        email.focus();

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

    formData.append("username",userEmail);
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

            setTimeout(async ()=>{

                let destination = "/mesas";

                try{

                    const userResponse = await fetch(`${API_URL}/auth/me`,{

                        headers:{
                            "Authorization":`Bearer ${data.access_token}`
                        }

                    });

                    if(userResponse.ok){

                        const user = await userResponse.json();
                        const role = window.CabanaPermissions?.getRole(user);

                        if(role){

                            destination = window.CabanaPermissions.getHomeRoute(role);

                        }

                    }

                }

                catch(error){

                    console.error("No fue posible determinar el módulo inicial.",error);

                }

                window.location.href=destination;

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