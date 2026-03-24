import Swal from 'sweetalert2';

const theme = {
  background: '#1f2937',  // gray-800
  color: '#f3f4f6',        // gray-100
  confirmButtonColor: '#6366f1', // indigo-500
  cancelButtonColor: '#4b5563',  // gray-600
};

export async function confirmAction(title: string, text: string): Promise<boolean> {
  const result = await Swal.fire({
    ...theme,
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, do it',
    cancelButtonText: 'Cancel',
  });
  return result.isConfirmed;
}

export async function showSuccess(title: string, text?: string): Promise<void> {
  await Swal.fire({ ...theme, title, text, icon: 'success', timer: 2000, showConfirmButton: false });
}

export async function showError(title: string, text?: string): Promise<void> {
  await Swal.fire({ ...theme, title, text, icon: 'error' });
}

export async function promptInput(title: string, placeholder?: string): Promise<string | null> {
  const result = await Swal.fire({
    ...theme,
    title,
    input: 'text',
    inputPlaceholder: placeholder ?? '',
    showCancelButton: true,
  });
  return result.isConfirmed ? (result.value as string) : null;
}
