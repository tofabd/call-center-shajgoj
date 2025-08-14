import React from 'react';
import { addOrderNote } from '@/services/api';
import { useState } from 'react';

interface WooCommerceOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  billing: any;
  shipping: any;
  line_items: any[];
  _links: any;
}

interface OrderNotesPanelProps {
  order: WooCommerceOrder;
  notesQuery: any;
  onClose: () => void;
}

const OrderNotesPanel: React.FC<OrderNotesPanelProps> = ({ order, notesQuery, onClose }) => {
  const { data, isLoading, isError, error, refetch } = notesQuery;
  const notes = data?.data || [];

  const [showInput, setShowInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState(false);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addOrderNote(order.id, noteText, customerNote);
      setNoteText('');
      setShowInput(false);
      setCustomerNote(false);
      refetch();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || err?.message || 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-gray-800 dark:to-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Order Notes</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">Order #{order.id}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-red-500 rounded-lg p-1 transition-colors" title="Close">
          <span className="text-lg">&times;</span>
        </button>
      </div>
      <div className="px-4 pt-4 pb-2 flex justify-end">
        {!showInput && (
          <button
            className="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => setShowInput(true)}
          >
            Add Note
          </button>
        )}
      </div>
      {showInput && (
        <div className="px-4 pb-2">
          <textarea
            className="w-full rounded border border-gray-300 dark:border-gray-600 p-2 text-sm mb-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            rows={3}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Type your note..."
            disabled={submitting}
          />
          {submitError && <div className="text-red-500 text-xs mb-1">{submitError}</div>}
          <div className="flex items-center gap-2 mb-2">
            <select
              className="rounded border border-gray-300 dark:border-gray-600 p-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-w-[150px] w-auto whitespace-nowrap"
              value={customerNote ? 'customer' : 'private'}
              onChange={e => setCustomerNote(e.target.value === 'customer')}
              disabled={submitting}
            >
              <option value="private">Private Note</option>
              <option value="customer">Note to Customer</option>
            </select>
            <div className="flex-1" />
            <button
              className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => { setShowInput(false); setNoteText(''); setSubmitError(null); setCustomerNote(false); }}
              disabled={submitting}
            >Cancel</button>
            <button
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
              onClick={handleAddNote}
              disabled={submitting || !noteText.trim()}
            >{submitting ? 'Adding...' : 'Add Note'}</button>
          </div>
        </div>
      )}
      <div className="p-4 max-h-[800px] overflow-y-auto narrow-scrollbar">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-400">Loading notes...</div>
        ) : isError ? (
          <div className="text-center text-red-500 dark:text-red-400">{error?.message || 'Failed to load notes'}</div>
        ) : notes.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400">No notes for this order.</div>
        ) : (
          <ul className="space-y-4">
            {notes.map((note: any) => (
              <li key={note.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm text-gray-800 dark:text-white flex-1">{note.note}</div>
                  {note.customer_note && (
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded">Customer</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>By: {note.added_by_user ? note.added_by_user : note.author || 'System'}</span>
                  <span>{note.date_created ? new Date(note.date_created).toLocaleString() : ''}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OrderNotesPanel; 