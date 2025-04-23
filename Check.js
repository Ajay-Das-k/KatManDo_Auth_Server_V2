function fetchSalesforceUserInfo() {
  const serverURL = "https://katman.io/";
  const endpoint = "appscript/userinfo";

  // Ensure the server URL ends with a slash
  const baseURL = serverURL.endsWith("/") ? serverURL : serverURL + "/";

  // Get the auth token from user properties
  const authToken =
    PropertiesService.getUserProperties().getProperty("authToken");

  if (!authToken) {
    console.error(
      "No authentication token found. User may need to log in first."
    );
    return {
      success: false,
      error: "Authentication required. Please log in first.",
    };
  }

  try {
    // Set up the request options with the JWT token in the Authorization header
    const options = {
      method: "get",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    };

    // Make the request to the Salesforce userinfo endpoint on our server
    const response = UrlFetchApp.fetch(baseURL + endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    const responseData = JSON.parse(responseText);

    // Log the response for debugging (optional)
    console.log("Salesforce user info response:", responseData);

    // Check if request was successful
    if (responseCode === 200 && responseData.success) {
      // Get the user info from the response
      const userInfo = responseData.userInfo;

      // Save the entire userInfo object as a JSON string in script properties
      PropertiesService.getScriptProperties().setProperty(
        "salesforceUserInfo",
        JSON.stringify(userInfo)
      );

      // Save a timestamp of when the data was retrieved
      const timestamp = new Date().toISOString();
      PropertiesService.getScriptProperties().setProperty(
        "salesforceUserInfoLastUpdated",
        timestamp
      );

      return {
        success: true,
        message: "Salesforce user information retrieved and saved successfully",
        userInfo: userInfo,
      };
    } else {
      // Handle error response
      console.error(
        "Failed to fetch Salesforce user info:",
        responseData.error
      );
      return {
        success: false,
        error:
          responseData.error || "Failed to fetch Salesforce user information",
      };
    }
  } catch (error) {
    console.error("Error in fetchSalesforceUserInfo:", error.toString());
    return {
      success: false,
      error: "Error connecting to server: " + error.toString(),
    };
  }
}
