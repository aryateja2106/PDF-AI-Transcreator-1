-- Create the processed_documents table
CREATE TABLE IF NOT EXISTS processed_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_filename TEXT NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  target_language TEXT NOT NULL DEFAULT '',
  transcreated_text TEXT NOT NULL DEFAULT '',
  audio_url TEXT,
  processing_status TEXT NOT NULL DEFAULT 'extracting' 
    CHECK (processing_status IN ('extracting', 'transcreating', 'generating_audio', 'completed', 'failed')),
  pdf_info JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on processing_status for efficient queries
CREATE INDEX IF NOT EXISTS idx_processed_documents_status ON processed_documents(processing_status);

-- Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_processed_documents_created_at ON processed_documents(created_at DESC);

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_processed_documents_updated_at ON processed_documents;
CREATE TRIGGER update_processed_documents_updated_at
  BEFORE UPDATE ON processed_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE processed_documents ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on processed_documents" ON processed_documents
  FOR ALL USING (true);

-- Grant permissions to the authenticated role
GRANT ALL ON processed_documents TO authenticated;
GRANT ALL ON processed_documents TO anon; 