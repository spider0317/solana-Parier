import { toast, ToastOptions } from "react-toastify";
import 'react-toastify/dist/ReactToastify.min.css';

export const successToast = (message) => toast.success(message, toastSettings)
export const failureToast = (message) => toast.error(message, toastSettings)

const toastSettings: ToastOptions = {
    position: 'bottom-left',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: 'dark'
}
