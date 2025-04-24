/**
 * @desc    Iset ObjetInto Salesforce
 * @route   POST /appscript/insert
 * @access  Private
 */
const executeSalesforceQuery = asyncHandler(async (req, res) => {
  try {
    // Get user ID from JWT payload
    const { userId } = req.user;
    
    // Get the SOQL query from request body
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: "SOQL query is required in the request body"
      });
    }
    
    // Find the user's Salesforce access token
    const accessToken = await AccessToken.findOne({ userId });
    
    if (!accessToken) {
      return res.status(404).json({
        success: false,
        error: "No Salesforce access token found for this user"
      });
    }
    
    // Check if token needs refresh
    const tokenAge = Date.now() - new Date(accessToken.lastRefreshed).getTime();
    const TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (tokenAge > TOKEN_EXPIRY) {
      // Token might be expired, attempt to refresh it
      await refreshSalesforceToken(accessToken);
    }
    
    // Encode the SOQL query
    const encodedQuery = encodeURIComponent(query);
    const url = `${accessToken.instanceUrl}/services/data/v62.0/composite/sobjects`;
    
    // Make the request to Salesforce
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        success: false,
        error: errorData[0]?.message || 'Failed to execute query on Salesforce',
        salesforceError: errorData
      });
    }
    
    const data = await response.json();
    
    return res.status(200).json({
      success: true,
      totalRecords: data.totalSize,
      records: data.records,
      done: data.done,
      nextRecordsUrl: data.nextRecordsUrl
    });
    
  } catch (error) {
    console.error("Error executing Salesforce query:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while executing Salesforce query"
    });
  }
});