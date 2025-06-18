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
      // Strategy: Fetch ALL evaluations for this user to ensure accurate pagination
      // This is necessary because Firestore can't query nested fields in participants
      const allEvaluations: Evaluation[] = [];
      let lastDoc = null;
      let hasMoreData = true;
      
      // Keep fetching until we have no more data
      while (hasMoreData) {
        let currentQuery = query.limit(500); // Larger batch size for efficiency
        
        if (lastDoc) {
          currentQuery = currentQuery.startAfter(lastDoc);
        }
        
        const snapshot = await currentQuery.get();
        
        if (snapshot.empty) {
          hasMoreData = false;
          break;
        }
        
        const newEvaluations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Evaluation, 'id'>,
        }));
        
        allEvaluations.push(...newEvaluations);
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        // If we got less than limit, we've reached the end
        if (snapshot.docs.length < 500) {
          hasMoreData = false;
        }
      }
      
      // Filter evaluations where the user participated
      const userEvaluations = allEvaluations.filter(evalDoc => 
        evalDoc.evaluation.participants && 
        evalDoc.evaluation.participants[userId] !== undefined
      );
      
      console.log(`User ${userId}: Found ${userEvaluations.length} evaluations out of ${allEvaluations.length} total`);
      
      // Apply pagination to filtered results
      const startIndex = page * limit;
      const paginatedEvaluations = userEvaluations.slice(startIndex, startIndex + limit);
      
      // Check if there are more results
      const hasMore = userEvaluations.length > startIndex + limit;
      
      return NextResponse.json({
        evaluations: paginatedEvaluations,
        hasMore,
        page,
        limit,
        totalUserEvaluations: userEvaluations.length // Debug info
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