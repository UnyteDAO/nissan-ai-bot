import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import type { Evaluation } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '0');
    
    const query = db.collection('evaluations')
      .orderBy('createdAt', 'desc');

    // For pagination with userId filter, we need to fetch more documents
    // and filter in memory since Firestore doesn't support complex queries
    if (userId) {
      // Fetch enough documents to ensure we can return the requested page after filtering
      const bufferSize = (page + 1) * limit * 5; // Buffer to ensure enough results
      const snapshot = await query.limit(bufferSize).get();
      
      // Filter evaluations where the user participated
      const allUserEvaluations = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Evaluation, 'id'>,
        }))
        .filter(evalDoc => 
          evalDoc.evaluation.participants && 
          evalDoc.evaluation.participants[userId] !== undefined
        );
      
      // Apply pagination to filtered results
      const startIndex = page * limit;
      const paginatedEvaluations = allUserEvaluations.slice(startIndex, startIndex + limit);
      
      // Check if there are more results
      const hasMore = allUserEvaluations.length > startIndex + limit;
      
      return NextResponse.json({
        evaluations: paginatedEvaluations,
        hasMore,
        page,
        limit
      });
    } else {
      // Without userId filter, we can use Firestore's pagination more efficiently
      const offset = page * limit;
      const snapshot = await query
        .limit(limit + 1) // Get one extra to check if there are more
        .offset(offset)
        .get();
      
      const evaluations: Evaluation[] = snapshot.docs
        .slice(0, limit) // Remove the extra document
        .map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Evaluation, 'id'>,
        }));
      
      const hasMore = snapshot.docs.length > limit;
      
      return NextResponse.json({
        evaluations,
        hasMore,
        page,
        limit
      });
    }
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    );
  }
}