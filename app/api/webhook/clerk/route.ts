import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createUser, deleteUser, updateUser } from '@/lib/actions/user.actions'
import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
 
export async function POST(req: Request) {
  try {
    console.log('Webhook endpoint hit!');

    const WEBHOOK_SECRET = process.env.NEXT_CLERK_WEBHOOK_SECRET;
    
    // Log secret format (safely)
    console.log('Secret check:', {
      exists: !!WEBHOOK_SECRET,
      length: WEBHOOK_SECRET?.length,
      startsWithWhsec: WEBHOOK_SECRET?.startsWith('whsec_'),
      // Only log first 5 chars to be safe
      preview: WEBHOOK_SECRET?.substring(0, 5)
    });

    if (!WEBHOOK_SECRET) {
      console.error('Missing NEXT_CLERK_WEBHOOK_SECRET');
      return new Response('Webhook secret not configured', { 
        status: 500 
      });
    }

    // Get the headers
    const headersList = await headers();
    const svix_id = headersList.get("svix-id");
    const svix_timestamp = headersList.get("svix-timestamp");
    const svix_signature = headersList.get("svix-signature");

    // Log raw signature format
    console.log('Signature format:', {
      exists: !!svix_signature,
      length: svix_signature?.length,
      preview: svix_signature?.substring(0, 10)
    });

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing svix headers:', { svix_id, svix_timestamp, svix_signature });
      return new Response('Missing svix headers', { 
        status: 400 
      });
    }

    // Get the body
    const payload = await req.json();
    console.log('Received webhook payload:', payload);
    const body = JSON.stringify(payload);

    // Verify webhook
    try {
      console.log('Attempting verification with secret starting with:', WEBHOOK_SECRET?.substring(0, 5));
      const wh = new Webhook(WEBHOOK_SECRET);
      
      // Log the exact payload being verified
      console.log('Verification payload:', {
        bodyLength: body.length,
        headers: {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature?.substring(0, 10) + '...'
        }
      });
      
      const evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
      
      console.log('Webhook verified successfully');
      
      // Get the ID and type
      const { id } = evt.data;
      const eventType = evt.type;

      if(eventType === 'user.created') {
        console.log('Webhook received user.created event');
        const { id, email_addresses, image_url, first_name, last_name, username } = evt.data;
        
        console.log('Extracted user data:', { 
          id, 
          email: email_addresses[0].email_address, 
          username, 
          first_name, 
          last_name 
        });

        const user = {
          clerkId: id,
          email: email_addresses[0].email_address,
          username: username!,
          firstName: first_name ?? "",
          lastName: last_name ?? "",
          photo: image_url,
        }

        console.log('Attempting to create user with data:', user);

        const newUser = await createUser(user);
        
        console.log('User creation result:', newUser);

        if(newUser) {
          console.log('Updating Clerk metadata for user:', id);
          const clerk = await clerkClient();
          await clerk.users.updateUserMetadata(id, {
            publicMetadata: {
              userId: newUser._id
            }
          });
          console.log('Clerk metadata updated successfully');
        }

        return NextResponse.json({ message: 'OK', user: newUser })
      }

      if (eventType === 'user.updated') {
        const {id, image_url, first_name, last_name, username } = evt.data

        const user = {
          firstName: first_name ?? "",
          lastName: last_name ?? "",
          username: username!,
          photo: image_url,
        }

        const updatedUser = await updateUser(id, user)

        return NextResponse.json({ message: 'OK', user: updatedUser })
      }

      if (eventType === 'user.deleted') {
        const { id } = evt.data

        const deletedUser = await deleteUser(id!)

        return NextResponse.json({ message: 'OK', user: deletedUser })
      }

      return new Response('', { status: 200 })
    } catch (err) {
      console.error('Verification failed:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        secretFormat: {
          length: WEBHOOK_SECRET.length,
          startsWithWhsec: WEBHOOK_SECRET.startsWith('whsec_'),
        },
        signatureFormat: {
          length: svix_signature?.length,
          sample: svix_signature?.substring(0, 10)
        }
      });
      return new Response('Webhook verification failed', { status: 400 });
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(`Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500 
    });
  }
}
 