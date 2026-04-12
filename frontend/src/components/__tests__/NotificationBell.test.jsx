import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../NotificationBell.jsx';
import axios from 'axios';

jest.mock('axios');

describe('NotificationBell', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders bell icon', () => {
        axios.get.mockResolvedValue({ data: { notifications: [] } });
        render(<NotificationBell role="Warehouse" />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('shows unread count badge when there are unread notifications', async () => {
        axios.get.mockResolvedValue({
            data: {
                notifications: [
                    { id: 1, title: 'Test', message: 'Hello', is_read: false, created_at: new Date().toISOString() },
                    { id: 2, title: 'Test2', message: 'World', is_read: true, created_at: new Date().toISOString() },
                ],
            },
        });

        render(<NotificationBell role="Warehouse" />);

        await waitFor(() => {
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });

    test('clicking bell toggles dropdown', async () => {
        axios.get.mockResolvedValue({ data: { notifications: [] } });
        render(<NotificationBell role="Warehouse" />);

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    test('calls onNavigate when notification is clicked', async () => {
        const mockNavigate = jest.fn();
        const mockNotification = {
            id: 1,
            title: 'Test',
            message: 'Hello',
            is_read: false,
            link: '/inbox',
            created_at: new Date().toISOString(),
        };

        axios.get.mockResolvedValue({ data: { notifications: [mockNotification] } });
        axios.post.mockResolvedValue({ data: { success: true } });

        render(<NotificationBell role="Supplier" email="test@test.com" onNavigate={mockNavigate} />);

        await waitFor(() => {
            const button = screen.getByRole('button');
            fireEvent.click(button);
        });

        const notificationItem = screen.getByText('Test');
        fireEvent.click(notificationItem);

        expect(mockNavigate).toHaveBeenCalledWith('/inbox');
    });
});