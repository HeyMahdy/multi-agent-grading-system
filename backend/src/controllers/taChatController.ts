import { Request, Response } from 'express';
import axios from 'axios';

const FASTAPI_URL = 'http://localhost:8000';

/**
 * Send a message to the TA chatbot
 */
export const chatWithTA = async (req: Request, res: Response) => {
  try {
    const teacherId = req.authUser?.id;
    const { message, history } = req.body;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const response = await axios.post(`${FASTAPI_URL}/internal/agent/ta/chat/json`, {
      teacher_id: teacherId,
      access_token: req.authUser?.accessToken,
      message,
      history: history || [],
    });

    return res.status(200).json({
      message: 'TA response generated',
      data: {
        response: response.data.response
      }
    });

  } catch (error: any) {
    console.error('Error communicating with TA Agent:', error.message);
    return res.status(500).json({
      error: 'Failed to get TA response',
      details: error.response?.data || error.message
    });
  }
};
