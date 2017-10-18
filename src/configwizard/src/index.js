import './css/index.css';

import React from 'react';
import ReactDOM from 'react-dom';
import {createStore, applyMiddleware} from 'redux';
import thunkMiddleware from 'redux-thunk';
import freeze from 'redux-freeze';
import {Provider} from 'react-redux';

import rootReducer, {withLogging} from './reducers/'

import App from './components/App';

const store = createStore(
    withLogging(rootReducer),
    applyMiddleware(thunkMiddleware, freeze)
)

const renderApp = () => {
    ReactDOM.render(
        <Provider store={store}>
            <App/>
        </Provider>,
        
        document.getElementById('configwizard-root')
    );
}
if (module.hot) {
    module.hot.accept('./components/App', renderApp);
}

renderApp();