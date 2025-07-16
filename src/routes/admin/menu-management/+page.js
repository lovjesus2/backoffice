import { redirect } from '@sveltejs/kit';

export async function load({ parent }) {
  const { user } = await parent();
  
  if (!user) {
    throw redirect(302, '/?redirectTo=/admin/menu-management');
  }
  
  if (user.role !== 'admin') {
    throw redirect(302, '/admin?error=access_denied');
  }
  
  return {};
}
