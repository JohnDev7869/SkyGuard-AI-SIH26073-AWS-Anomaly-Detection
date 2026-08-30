import torch
import torch.nn as nn
import numpy as np

class LSTMAutoencoder(nn.Module):
    def __init__(self, input_dim=3, hidden_dim=16, num_layers=1):
        super(LSTMAutoencoder, self).__init__()
        self.encoder = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, input_dim, num_layers, batch_first=True)
        
    def forward(self, x):
        # x shape: (batch, seq_len, features)
        encoded_output, (hidden, cell) = self.encoder(x)
        # We repeat the hidden state to form the input for the decoder
        # hidden shape: (num_layers, batch, hidden_dim)
        decoder_input = hidden[-1].unsqueeze(1).repeat(1, x.size(1), 1)
        decoded_output, _ = self.decoder(decoder_input)
        return decoded_output

class TemporalDetector:
    def __init__(self, seq_len=10, threshold_percentile=95):
        self.seq_len = seq_len
        self.threshold_percentile = threshold_percentile
        self.model = LSTMAutoencoder(input_dim=3, hidden_dim=16)
        self.threshold = 0.5 # Default, will be updated during training
        self.is_fitted = False
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

    def _prepare_sequences(self, df):
        data = df[['temperature', 'pressure', 'humidity']].values
        # Simple min-max scaling (assuming known reasonable bounds for demo)
        mins = np.array([-40.0, 800.0, 0.0])
        maxs = np.array([60.0, 1200.0, 100.0])
        scaled = (data - mins) / (maxs - mins)
        
        sequences = []
        for i in range(len(scaled) - self.seq_len):
            sequences.append(scaled[i:i+self.seq_len])
        return torch.tensor(np.array(sequences), dtype=torch.float32)

    def fit(self, history_df, epochs=10, lr=0.01):
        if len(history_df) < self.seq_len * 2:
            return # Not enough data
            
        self.model.train()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        criterion = nn.MSELoss()
        
        X = self._prepare_sequences(history_df).to(self.device)
        
        for epoch in range(epochs):
            optimizer.zero_grad()
            output = self.model(X)
            loss = criterion(output, X)
            loss.backward()
            optimizer.step()
            
        # Compute threshold
        self.model.eval()
        with torch.no_grad():
            output = self.model(X)
            errors = torch.mean((output - X)**2, dim=(1, 2)).cpu().numpy()
            self.threshold = np.percentile(errors, self.threshold_percentile)
            self.is_fitted = True

    def predict(self, window_df):
        """
        window_df: dataframe containing the last `seq_len` readings.
        """
        if not self.is_fitted or len(window_df) < self.seq_len:
            return {'detector_name': 'temporal', 'is_anomaly': False, 'score': 0.0}
            
        self.model.eval()
        X = self._prepare_sequences(window_df.tail(self.seq_len + 1)).to(self.device)
        if len(X) == 0:
            return {'detector_name': 'temporal', 'is_anomaly': False, 'score': 0.0}
            
        with torch.no_grad():
            # Get error of the last sequence
            x_target = X[-1].unsqueeze(0)
            output = self.model(x_target)
            error = torch.mean((output - x_target)**2).item()
            
        # Score is normalized error (larger = more anomalous)
        # We invert it or adjust so it aligns with IsolationForest? 
        # Actually, let's keep error as is and fusion model will figure it out.
        is_anomaly = error > self.threshold
        return {
            'detector_name': 'temporal',
            'is_anomaly': is_anomaly,
            'score': error,
            'details': {'reconstruction_error': error, 'threshold': self.threshold}
        }
