import { render, screen, fireEvent } from '@testing-library/react';
import NotificationBell from '../NotificationBell';
import axios from 'axios';

jest.mock('axios');

describe('NotificationBell', () => {
    test('renders bell icon and shows unread count', async () => {
        axios.get.mockResolvedValue({
            data: {
                notifications: [
                    { id: 1, title: 'Test', message: 'Hello', is_read: false },
                    { id: 2, title: 'Test2', message: 'World', is_read: true },
                ],
            },
        });

        render(<NotificationBell role="Warehouse" />);

        const bellButton = await screen.findByRole('button');
        expect(bellButton).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument(); // unread count
    });
});