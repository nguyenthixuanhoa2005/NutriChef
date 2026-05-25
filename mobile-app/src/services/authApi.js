import {
	authRequest,
	clearAuthTokens,
	getAuthTokens,
	request,
	setAuthTokens,
} from './client';

const defaultHeaders = {
	'Content-Type': 'application/json',
};

export const loginWithEmail = async ({ email, password, rememberLogin = false }) => {
	const data = await request('/api/auth/login', {
		method: 'POST',
		headers: defaultHeaders,
		body: JSON.stringify({ email, password }),
	});

	await setAuthTokens({
		accessToken: data.accessToken,
		refreshToken: data.refreshToken,
		persist: rememberLogin,
	});

	return data;
};

export const register = async ({ email, password, fullName }) => {
	const data = await request('/api/auth/register', {
		method: 'POST',
		headers: defaultHeaders,
		body: JSON.stringify({ email, password, fullName }),
	});

	return data;
};

export const fetchCurrentUser = async () => {
	const data = await authRequest('/api/auth/me', {
		method: 'GET',
	});

	return data?.user || null;
};

export const bootstrapAuthSession = async () => {
	const { accessToken, refreshToken } = await getAuthTokens();
	if (!accessToken && !refreshToken) {
		return null;
	}

	try {
		const user = await fetchCurrentUser();
		return user;
	} catch (error) {
		await clearAuthTokens();
		return null;
	}
};

export const loginWithGoogle = async ({ idToken, accessToken, rememberLogin = false }) => {
	const data = await request('/api/auth/social/google', {
		method: 'POST',
		headers: defaultHeaders,
		body: JSON.stringify({ idToken, accessToken }),
	});

	await setAuthTokens({
		accessToken: data.accessToken,
		refreshToken: data.refreshToken,
		persist: rememberLogin,
	});

	return data;
};

export const logout = async () => {
	const { refreshToken } = await getAuthTokens();
	try {
		await request('/api/auth/logout', {
			method: 'POST',
			headers: defaultHeaders,
			body: JSON.stringify({ refreshToken }),
		});
	} finally {
		await clearAuthTokens();
	}
};
