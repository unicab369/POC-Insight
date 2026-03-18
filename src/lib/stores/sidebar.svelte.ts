let open = $state(false);

export const sidebar = {
	get open() { return open; },
	set open(v: boolean) { open = v; },
	toggle() { open = !open; }
};
