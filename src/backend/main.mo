import Iter "mo:core/Iter";
import Array "mo:core/Array";
import List "mo:core/List";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Initialize the user system state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  include MixinStorage();

  // User Profile Type
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // File System Types
  type FileId = Text;

  let files = Map.empty<FileId, FileSystemEntry>();

  // Separate map for password hashes (SHA-256 hex strings set by client)
  let filePasswords = Map.empty<FileId, Text>();

  // File system entry
  type FileSystemEntry = {
    id : FileId;
    name : Text;
    mimeType : Text;
    size : Nat;
    uploadDate : Time.Time;
    blobId : ?Text;
    parentFolderId : ?FileId;
    isFolder : Bool;
    textContent : ?Text;
    owner : Principal;
    isLocked : Bool;
  };

  module FileSystemEntry {
    public func compare(fsEntry1 : FileSystemEntry, fsEntry2 : FileSystemEntry) : {
      #less;
      #equal;
      #greater;
    } {
      Text.compare(fsEntry1.name, fsEntry2.name);
    };
  };

  // Helper function to check if caller can access a file
  func canAccessFile(caller : Principal, file : FileSystemEntry) : Bool {
    AccessControl.isAdmin(accessControlState, caller) or file.owner == caller;
  };

  public query ({ caller }) func listFilesByFolder(folderId : ?FileId) : async [FileSystemEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list files");
    };

    let isAdmin = AccessControl.isAdmin(accessControlState, caller);
    
    files.values().toArray().filter(func(entry) {
      entry.parentFolderId == folderId and (isAdmin or entry.owner == caller)
    }).sort();
  };

  public query ({ caller }) func getFileById(id : FileId) : async FileSystemEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access files");
    };

    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized: You can only access your own files");
        };
        file;
      };
    };
  };

  public shared ({ caller }) func createFolder(name : Text, parentFolderId : ?FileId) : async FileId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create folders");
    };

    switch (parentFolderId) {
      case (?parentId) {
        switch (files.get(parentId)) {
          case (null) { Runtime.trap("Parent folder not found") };
          case (?parent) {
            if (not canAccessFile(caller, parent)) {
              Runtime.trap("Unauthorized: You can only create folders in your own folders");
            };
          };
        };
      };
      case (null) {};
    };

    let id = name # Time.now().toText();
    let folder : FileSystemEntry = {
      id;
      name;
      mimeType = "";
      size = 0;
      uploadDate = Time.now();
      blobId = null;
      parentFolderId;
      isFolder = true;
      textContent = null;
      owner = caller;
      isLocked = false;
    };
    files.add(id, folder);
    id;
  };

  public shared ({ caller }) func deleteFile(id : FileId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete files");
    };

    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized: You can only delete your own files");
        };
        files.remove(id);
        filePasswords.remove(id);
      };
    };
  };

  public shared ({ caller }) func renameFile(id : FileId, newName : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can rename files");
    };

    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized: You can only rename your own files");
        };
        let updatedFile = {
          file with
          name = newName;
        };
        files.add(id, updatedFile);
      };
    };
  };

  public shared ({ caller }) func storeTextFileContent(name : Text, content : Text, parentFolderId : ?FileId) : async FileId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can store files");
    };

    switch (parentFolderId) {
      case (?parentId) {
        switch (files.get(parentId)) {
          case (null) { Runtime.trap("Parent folder not found") };
          case (?parent) {
            if (not canAccessFile(caller, parent)) {
              Runtime.trap("Unauthorized: You can only create files in your own folders");
            };
          };
        };
      };
      case (null) {};
    };

    let id = name # Time.now().toText();
    let file : FileSystemEntry = {
      id;
      name;
      mimeType = "text/plain";
      size = content.size();
      uploadDate = Time.now();
      blobId = null;
      parentFolderId;
      isFolder = false;
      textContent = ?content;
      owner = caller;
      isLocked = false;
    };
    files.add(id, file);
    id;
  };

  public query ({ caller }) func getTextFileContent(id : FileId) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access file content");
    };

    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized: You can only access your own files");
        };
        switch (file.textContent) {
          case (null) { Runtime.trap("No text content") };
          case (?content) { content };
        };
      };
    };
  };

  public shared ({ caller }) func updateTextContent(id : FileId, newContent : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update files");
    };

    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized: You can only update your own files");
        };
        let updatedFile = {
          file with
          textContent = ?newContent;
          size = newContent.size();
        };
        files.add(id, updatedFile);
      };
    };
  };

  // --- Password protection ---

  // Set or change a password on a file (passwordHash is SHA-256 hex from client)
  public shared ({ caller }) func setFilePassword(id : FileId, passwordHash : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized: You can only lock your own files");
        };
        filePasswords.add(id, passwordHash);
        files.add(id, { file with isLocked = true });
      };
    };
  };

  // Remove password from a file (caller must supply current hash to verify)
  public shared ({ caller }) func removeFilePassword(id : FileId, currentPasswordHash : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized: You can only unlock your own files");
        };
        switch (filePasswords.get(id)) {
          case (null) { Runtime.trap("File has no password") };
          case (?hash) {
            if (hash != currentPasswordHash) {
              Runtime.trap("Incorrect password");
            };
            filePasswords.remove(id);
            files.add(id, { file with isLocked = false });
          };
        };
      };
    };
  };

  // Verify password (returns true if correct, false if wrong)
  public query ({ caller }) func verifyFilePassword(id : FileId, passwordHash : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized");
        };
        switch (filePasswords.get(id)) {
          case (null) { false };
          case (?hash) { hash == passwordHash };
        };
      };
    };
  };

  // Check if a file is locked
  public query ({ caller }) func isFileLocked(id : FileId) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?file) {
        if (not canAccessFile(caller, file)) {
          Runtime.trap("Unauthorized");
        };
        file.isLocked;
      };
    };
  };
};
