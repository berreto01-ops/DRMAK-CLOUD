import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import * as React from 'react';

export const useNotifications = () => {
    const firestore = useFirestore();
    const { user } = useUser();
    const userId = user?.id;
    const userRole = user?.role;

    // 1. Pending Prescriptions (Operations Manager)
    const prescQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'prescriptions'),
            where('printStatus', '==', 'Pending')
        );
    }, [firestore, userId]);
    const { data: prescriptions } = useCollection(prescQuery);

    // 2. New Leads (Sales / Digital)
    const leadsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;

        const baseQuery = collection(firestore, 'leads');

        if (userRole === 'Sales') {
            return query(
                baseQuery,
                where('status', '==', 'New Lead'),
                where('assignedTo', '==', userId)
            );
        }

        return query(
            baseQuery,
            where('status', '==', 'New Lead')
        );
    }, [firestore, userId, userRole]);
    const { data: leads } = useCollection(leadsQuery);

    // 3. Social Inbox (Digital / Users)
    const chatsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'chats'),
            where('participants', 'array-contains', userId)
        );
    }, [firestore, userId]);
    const { data: chats } = useCollection<any>(chatsQuery);

    const unreadChatsCount = React.useMemo(() => {
        if (!chats || !userId) return 0;
        return chats.filter(chat =>
            chat.lastSenderId &&
            chat.lastSenderId !== userId &&
            (!chat.readBy || !chat.readBy.includes(userId))
        ).length;
    }, [chats, userId]);

    return React.useMemo(() => ({
        printPrescription: prescriptions?.length || 0,
        leads: leads?.length || 0,
        socialInbox: unreadChatsCount,
    }), [prescriptions?.length, leads?.length, unreadChatsCount]);
};
