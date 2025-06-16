import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import type { Thread, Evaluation } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const threadId = params.threadId;

    // Get thread data
    const threadDoc = await db.collection('threads').doc(threadId).get();
    
    if (!threadDoc.exists) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    const thread = {
      id: threadDoc.id,
      ...threadDoc.data()
    } as Thread;

    // Get evaluation data if exists
    let evaluation = null;
    if (thread.evaluationId) {
      const evalDoc = await db
        .collection('evaluations')
        .doc(thread.evaluationId)
        .get();
      
      if (evalDoc.exists) {
        evaluation = {
          id: evalDoc.id,
          ...evalDoc.data()
        } as Evaluation;
      }
    }

    return NextResponse.json({
      thread,
      evaluation
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}