import React from 'react';
import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material/styles';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ConfirmProvider } from 'material-ui-confirm';

import App from '~/App.jsx';
import theme from '~/theme.js';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <CssVarsProvider theme={theme}>
            <ConfirmProvider
                defaultOptions={{
                    allowClose: false,
                    confirmationButtonProps: { color: 'info', variant: 'outlined' },
                    cancellationButtonProps: { color: 'inherit' },
                }}
            >
                <CssBaseline />
                <App />
                <ToastContainer
                    position="bottom-left"
                    autoClose={2000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                />
            </ConfirmProvider>
        </CssVarsProvider>
    </React.StrictMode>,
);
