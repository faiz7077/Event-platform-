import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createUser, deleteUser, updateUser } from '@/lib/actions/user.actions'
import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
 
export async function POST(req: Request) {
  try {
    console.log('Webhook endpoint hit!');

    // Log raw headers for debugging
    const headersList = headers();
    const allHeaders = {};
    headersList.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log('Received headers:', allHeaders);

    const WEBHOOK_SECRET = process.env.NEXT_CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      console.error('Missing NEXT_CLERK_WEBHOOK_SECRET');
      return new Response('Webhook secret not configured', { 
        status: 500 
      });
    }

    // Get the headers
    const svix_id = headersList.get("svix-id");
    const svix_timestamp = headersList.get("svix-timestamp");
    const svix_signature = headersList.get("svix-signature");

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
      const wh = new Webhook(WEBHOOK_SECRET);
      const evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
      
      console.log('Webhook verified, processing event:', evt.type);
      
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
      console.error('Webhook verification failed:', err);
      return new Response('Webhook verification failed', { 
        status: 400 
      });
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(`Webhook error: ${error.message}`, { 
      status: 500 
    });
  }
}
 