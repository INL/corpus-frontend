declare const process: any;
let debug = process.env.NODE_ENV === 'development';

let queued: IArguments[] = [];

// If you wish to see the original logging location, blackbox this script in the chrome devtools
// For now, seeing the original location is not supported in firefox and edge/ie (and probably safari)
export function debugLog(...args: any[]) {
	if (debug) {
		console.log.apply(console, arguments); //tslint:disable-line
	} else {
		queued.push(arguments);
	}
}

export function enable() {
	debug = true;
	for (const argArray of queued) {
		debugLog.apply(undefined, argArray);
	}
	queued = [];
}

export function disable() {
	debug = false;
}

export function monitorRedraws() {
	const style = document.createElement('style');
	style.textContent = `
	@keyframes flash {
		0% { outline: 1px solid rgba(255,0,0,1); }
		99% { outline: 1px solid rgba(255,0,0,0); }
		100% { outline: none; }
	}

	* {
		animation: flash 1s;
	}
	`;

	document.body.appendChild(style);

	const stopAnimationListener = function(this: HTMLElement) {
		this.style.animationPlayState = 'paused';
		this.onanimationend = null;
	};

	const observer = new MutationObserver((mutations, ob) => {
		mutations.forEach(mutation => {

			const targets = [] as HTMLElement[];
			switch (mutation.type) {
				case 'characterData': targets.push(mutation.target.parentElement!); break;
				case 'attributes': {
					if (mutation.attributeName !== 'style' && mutation.target) {
						targets.push(mutation.target as HTMLElement);
					}
					break;
				}
				case 'childList': mutation.addedNodes.length > 0 ? targets.push(mutation.addedNodes.item(0)!.parentElement!) : targets.push(mutation.removedNodes.item(0)!.parentElement!); break;
			}

			window.requestAnimationFrame(() => {
				targets.forEach(t => {
					t.style.animation = 'none';
				});
				window.requestAnimationFrame(() => targets.forEach(t => {
					t.style.animation = 'flash 1s';
					t.onanimationend = stopAnimationListener;
				}));
			});
		});
	});

	observer.observe(document, {
		attributes: true,
		characterData: true,
		childList: true,
		subtree: true
	});
}

// monitorRedraws();

export default debug;
